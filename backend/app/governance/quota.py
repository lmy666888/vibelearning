"""Atomic pre-dispatch reservations; memory is explicitly local-only, Redis is required in production."""
import asyncio,hashlib,hmac,json,math,os,secrets,time
from dataclasses import dataclass,field
class GovernanceError(Exception):
    def __init__(self,code,status=429,retry=1):self.code,self.status,self.retry=code,status,retry
@dataclass(frozen=True)
class Limits:
    minute:int=5;daily:int=30;network_minute:int=20;network_daily:int=120;global_daily:int=200
    concurrency:int=2;input_tokens:int=32768;ordinary_output:int=1200;lesson_output:int=3500
    context_bytes:int=32768;body_bytes:int=65536;max_messages:int=8;prompt_chars:int=2000
    timeout:float=30;retries:int=0;daily_usd:float=1;input_price:float=2;output_price:float=10
    production:bool=False;redis_url:str=field(default='',repr=False);secret:str=field(default='',repr=False)
    @classmethod
    def load(cls):
        defaults=cls();values={}
        for key in ['minute','daily','network_minute','network_daily','global_daily','concurrency','input_tokens','ordinary_output','lesson_output','retries','context_bytes','body_bytes','max_messages','prompt_chars']:
            values[key]=int(os.getenv('AI_'+key.upper(),getattr(defaults,key)))
            if not (0<=values[key]<=1000000) or (key!='retries' and values[key]<1):raise GovernanceError('quota_unavailable',503)
        for key in ['timeout','daily_usd','input_price','output_price']:
            values[key]=float(os.getenv('AI_'+key.upper(),getattr(defaults,key)))
            if not math.isfinite(values[key]) or values[key]<=0:raise GovernanceError('quota_unavailable',503)
        if values['retries']>2 or values['timeout']>120 or values['concurrency']>100 or max(values['ordinary_output'],values['lesson_output'])>8000:raise GovernanceError('quota_unavailable',503)
        values.update(production=os.getenv('AI_ENV','development')=='production',redis_url=os.getenv('AI_REDIS_URL',''),secret=os.getenv('AI_SESSION_SECRET',''))
        if values['production'] and (not values['redis_url'] or len(values['secret'])<32 or 'AI_INPUT_PRICE' not in os.environ or 'AI_OUTPUT_PRICE' not in os.environ):raise GovernanceError('quota_unavailable',503)
        return cls(**values)
    def cost(self,input_tokens,output_tokens):return math.ceil(input_tokens*self.input_price+output_tokens*self.output_price)

@dataclass
class Reservation:
    ident:str;specs:list;cost:int;remaining_minute:int;remaining_daily:int;duplicate_key:str
class MemoryStore:
    def __init__(self):self.lock=asyncio.Lock();self.counts={};self.leases={}
    async def reserve(self,specs,lease,expires,concurrency,cost,duplicate_key):
        async with self.lock:
            now=time.time();self.counts={k:v for k,v in self.counts.items() if v[1]>now};self.leases={k:v for k,v in self.leases.items() if v>now}
            if len(self.counts)>10000:raise GovernanceError('quota_unavailable',503)
            if len(self.leases)>=concurrency:raise GovernanceError('rate_limit_exceeded',429,1)
            for key,limit,increment,ttl,code,retry in specs:
                if self.counts.get(key,(0,0))[0]+increment>limit:raise GovernanceError(code,429,retry)
            for key,limit,increment,ttl,code,retry in specs:self.counts[key]=(self.counts.get(key,(0,0))[0]+increment,now+ttl)
            self.leases[lease]=expires
            return Reservation(lease,specs,cost,specs[0][1]-self.counts[specs[0][0]][0],specs[1][1]-self.counts[specs[1][0]][0],duplicate_key)
    async def finish(self,r,actual_cost=None,failed=False):
        async with self.lock:
            self.leases.pop(r.ident,None)
            if failed:self.counts.pop(r.duplicate_key,None)
            if actual_cost is not None:
                key=r.specs[-2][0]
                if key in self.counts:
                    value,expires=self.counts[key];self.counts[key]=(max(0,value-max(0,r.cost-actual_cost)),expires)

RESERVE_LUA='''
local specs=cjson.decode(ARGV[1]);local now=tonumber(ARGV[2]);redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now)
if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[5]) then return {'rate_limit_exceeded','1'} end
for _,s in ipairs(specs) do if tonumber(redis.call('GET',s[1]) or '0')+s[3]>s[2] then return {s[5],tostring(s[6])} end end
for _,s in ipairs(specs) do redis.call('INCRBY',s[1],s[3]);redis.call('EXPIRE',s[1],s[4]) end
redis.call('ZADD',KEYS[1],ARGV[4],ARGV[3]);redis.call('EXPIRE',KEYS[1],180)
return {'ok',tostring(specs[1][2]-tonumber(redis.call('GET',specs[1][1]))),tostring(specs[2][2]-tonumber(redis.call('GET',specs[2][1])))}
'''
FINISH_LUA='''
redis.call('ZREM',KEYS[1],ARGV[1]);if ARGV[2]=='1' then redis.call('DEL',KEYS[3]) end
if tonumber(ARGV[3])>0 and redis.call('EXISTS',KEYS[2])==1 then local v=tonumber(redis.call('GET',KEYS[2]));redis.call('SET',KEYS[2],math.max(0,v-tonumber(ARGV[3])),'KEEPTTL') end
return 1
'''
class RedisStore:
    def __init__(self,url):self.url=url
    async def reserve(self,specs,lease,expires,concurrency,cost,duplicate_key):
        from redis.asyncio import Redis
        try:
            async with Redis.from_url(self.url,decode_responses=True,socket_connect_timeout=2,socket_timeout=2) as client:
                result=await client.eval(RESERVE_LUA,len(specs)+1,'{ai}:leases',*[s[0] for s in specs],json.dumps(specs),time.time(),lease,expires,concurrency)
            if result[0]!='ok':raise GovernanceError(result[0],429,int(result[1]))
            return Reservation(lease,specs,cost,int(result[1]),int(result[2]),duplicate_key)
        except GovernanceError:raise
        except Exception:raise GovernanceError('quota_unavailable',503) from None
    async def finish(self,r,actual_cost=None,failed=False):
        from redis.asyncio import Redis
        try:
            async with Redis.from_url(self.url,decode_responses=True,socket_connect_timeout=2,socket_timeout=2) as client:
                await client.eval(FINISH_LUA,3,'{ai}:leases',r.specs[-2][0],r.duplicate_key,r.ident,'1' if failed else '0',0 if actual_cost is None else max(0,r.cost-actual_cost))
        except Exception:pass # Reservation remains conservatively charged; lease expires.

memory=MemoryStore()
def store_for(limits):return RedisStore(limits.redis_url) if limits.redis_url else memory

def specs_for(limits,session,network,digest,input_tokens,output_tokens):
    now=int(time.time());minute=now//60;day=now//86400;reset=86400-now%86400;wait=60-now%60;cost=limits.cost(input_tokens,output_tokens)
    specs=[(f'{{ai}}:sm:{session}:{minute}',limits.minute,1,120,'rate_limit_exceeded',wait),(f'{{ai}}:sd:{session}:{day}',limits.daily,1,reset+120,'daily_quota_exceeded',reset),(f'{{ai}}:nm:{network}:{minute}',limits.network_minute,1,120,'rate_limit_exceeded',wait),(f'{{ai}}:nd:{network}:{day}',limits.network_daily,1,reset+120,'daily_quota_exceeded',reset),(f'{{ai}}:g:{day}',limits.global_daily,1,reset+120,'global_budget_exhausted',reset),(f'{{ai}}:cost:{day}',math.floor(limits.daily_usd*1e6),cost,reset+120,'global_budget_exhausted',reset),(f'{{ai}}:duplicate:{session}:{digest}',1,1,10,'repeated_request',10)]
    return specs,cost

_LOCAL_SECRET=secrets.token_hex(32)
def secret(limits):return (limits.secret or _LOCAL_SECRET).encode()
def sign_session(sid,issued,limits):
    content=f'{sid}.{issued}';return content+'.'+hmac.new(secret(limits),content.encode(),hashlib.sha256).hexdigest()
def session_identity(cookie,limits):
    if cookie is None:return sign_session(secrets.token_hex(16),int(time.time()),limits)
    try:
        sid,stamp,signature=cookie.split('.');assert len(sid)==32 and all(c in '0123456789abcdef' for c in sid)
        assert 0<=time.time()-int(stamp)<=86400
        assert hmac.compare_digest(sign_session(sid,int(stamp),limits),cookie)
    except (ValueError,AssertionError):raise GovernanceError('invalid_session',401,0) from None
    return cookie
