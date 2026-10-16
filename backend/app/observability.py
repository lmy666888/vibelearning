"""Process-local bounded aggregate telemetry. No prompts, URLs, identifiers or exception text."""
import math,time,threading,os,hmac,asyncio
from collections import defaultdict
from fastapi import APIRouter,Request,HTTPException
from app.schemas.ai import StrictModel
from typing import Literal
from app.experiments.registry import REGISTRY
LOCK=threading.Lock();COUNTS=defaultdict(float);LATENCY=[0]*8
BUCKETS=(.01,.05,.25,1,5,30,120,math.inf)
ALLOWED={'api_requests','api_errors','api_cancelled','provider_calls','provider_errors','prompt_tokens','completion_tokens','reserved_micro_usd','settled_micro_usd','rate_rejections','scientific_errors','frontend_runtime','frontend_scientific'}
def count(name,value=1):
    if name in ALLOWED and type(value) in (int,float) and math.isfinite(value) and value>=0:
        with LOCK:COUNTS[name]+=value

def snapshot():
    with LOCK:return {'scope':'single process; aggregate across replicas in collector','counters':dict(COUNTS),'latency_seconds':{'buckets':[str(b) for b in BUCKETS],'counts':list(LATENCY)}}
class TelemetryMiddleware:
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']!='http':return await self.app(scope,receive,send)
        started=time.monotonic();status=500
        async def observed(message):
            nonlocal status
            if message['type']=='http.response.start':status=message['status']
            await send(message)
        try:await self.app(scope,receive,observed)
        except asyncio.CancelledError:
            count('api_cancelled');raise
        finally:
            elapsed=time.monotonic()-started;count('api_requests');count('api_errors',int(status>=400));count('rate_rejections',int(status==429))
            with LOCK:
                for i,b in enumerate(BUCKETS):
                    if elapsed<=b:LATENCY[i]+=1
router=APIRouter()
@router.get('/ops/metrics')
async def metrics(request:Request):
    expected=os.getenv('OPS_METRICS_TOKEN','')
    if len(expected)<32 or not hmac.compare_digest(request.headers.get('authorization',''),'Bearer '+expected):raise HTTPException(404)
    from app.governance.quota import Limits
    data=snapshot()
    try:
        limits=Limits.load();day=int(time.time())//86400;cost_key=f'{{ai}}:cost:{day}';calls_key=f'{{ai}}:g:{day}'
        if limits.redis_url:
            from redis.asyncio import Redis
            async with Redis.from_url(limits.redis_url,socket_connect_timeout=1,socket_timeout=1) as client:values=await client.mget(cost_key,calls_key)
            cost,calls=[int(v or 0) for v in values];source='shared Redis'
        else:
            from app.governance.quota import memory
            async with memory.lock:cost=memory.counts.get(cost_key,(0,0))[0];calls=memory.counts.get(calls_key,(0,0))[0]
            source='development process memory'
        data['budget']={'configured_daily_usd':limits.daily_usd,'estimated_used_usd':cost/1e6,'estimated_utilization':cost/(limits.daily_usd*1e6),'daily_calls':calls,'daily_call_limit':limits.global_daily,'utc_day':day,'source':source,'unit':'estimated USD; not a provider bill'}
    except Exception:data['budget']={'available':False}
    return data
class ClientEvent(StrictModel):
    kind:Literal['runtime','scientific']
    experiment_id:str
_CLIENT_WINDOW=0;_CLIENT_COUNT=0
@router.post('/telemetry/client-error',status_code=202)
async def client_error(body:ClientEvent,request:Request):
    global _CLIENT_WINDOW,_CLIENT_COUNT
    if request.headers.get('origin') not in request.app.state.frontend_origins:raise HTTPException(403)
    if body.experiment_id not in REGISTRY:raise HTTPException(422)
    # Constant-size, per-worker ingest cap, intentionally not an identity/rate-limit authority.
    minute=int(time.monotonic()//60)
    with LOCK:
        if _CLIENT_WINDOW!=minute:_CLIENT_WINDOW=minute;_CLIENT_COUNT=0
        if _CLIENT_COUNT>=60:raise HTTPException(429,headers={'Retry-After':'60'})
        _CLIENT_COUNT+=1
    count('frontend_'+body.kind)
    return {'accepted':True,'provenance':'untrusted client report'}
