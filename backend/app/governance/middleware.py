import hashlib,hmac,json,asyncio
from starlette.requests import Request
from starlette.responses import JSONResponse,Response
from app.governance.quota import Limits,GovernanceError,secret,session_identity
from app.governance.gateway import identity,Identity
from app.governance.policy import preflight,localized
COOKIE='vl_ai_session'
PATHS={'/api/ai/explain','/api/ai/plan-action','/api/ai/generate-lesson','/api/ai/evaluate-observation'}
class AIGovernanceMiddleware:
    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or not(scope['path'] in PATHS or scope['path'].startswith('/api/v2/ai/') or scope['path']=='/api/ai/session'):return await self.app(scope,receive,send)
        request=Request(scope);language='en'
        try:
            limits=Limits.load()
            origin=request.headers.get('origin')
            if origin and origin not in request.app.state.frontend_origins:return await JSONResponse({'detail':{'code':'origin_denied','message':'Frontend origin is not allowed.'}},403)(scope,receive,send)
            if not limits.production and (not request.client or request.client.host not in {'127.0.0.1','localhost','::1'}):return await JSONResponse({'detail':{'code':'local_only','message':'AI is local-only in development.'}},403)(scope,receive,send)
            signed=session_identity(request.cookies.get(COOKIE),limits);sid=signed.split('.')[0];network=hmac.new(secret(limits),(request.client.host if request.client else 'unknown').encode(),hashlib.sha256).hexdigest()
            who=Identity(sid,network,operation=scope['path'].rsplit('/',1)[-1],api_version=2 if scope['path'].startswith('/api/v2/') else 1)
            if scope['path']=='/api/ai/session':
                response=JSONResponse({'session':'server-issued','limits':{'minute':limits.minute,'daily':limits.daily},'remaining':None});response.set_cookie(COOKIE,signed,max_age=86400,httponly=True,samesite='strict',secure=limits.production);response.headers['Cache-Control']='no-store';return await response(scope,receive,send)
            data=bytearray()
            while True:
                part=await receive()
                if part['type']=='http.disconnect':return
                data.extend(part.get('body',b''))
                if len(data)>min(65536,limits.body_bytes):return await JSONResponse({'detail':{'code':'request_too_large','message':'Request body exceeds 64 KiB.'}},413)(scope,receive,send)
                if not part.get('more_body'):break
            try:
                body=json.loads(data);prompt=body.get('prompt',body.get('question',body.get('learning_goal',body.get('student_answer',''))));language=body.get('preferred_language') or ('zh-CN' if any('\u3400'<=c<='\u9fff' for c in prompt) else 'en')
                if language not in {'en','zh-CN'} or not isinstance(prompt,str) or not 1<=len(prompt.strip())<=2000:raise ValueError()
                if len(prompt)>limits.prompt_chars or len(json.dumps(body.get('context',body.get('simulation_context',{})),ensure_ascii=False).encode())>limits.context_bytes:raise GovernanceError('invalid_request',422,0)
                route=preflight(prompt)
                if route=='out_of_scope':raise GovernanceError('out_of_scope',422,0)
                if route=='needs_clarification':raise GovernanceError('clarification_required',409,0)
            except (ValueError,TypeError,AttributeError):
                # Preserve Pydantic's safe structured errors for malformed bodies.
                body=None
            who.language=language;token=identity.set(who);delivered=False;body_read=asyncio.Event()
            async def replay():
                nonlocal delivered
                if not delivered:delivered=True;body_read.set();return {'type':'http.request','body':bytes(data),'more_body':False}
                return await receive()
            async def guarded_send(message):
                if message['type']=='http.response.start':
                    headers=list(message.get('headers',[]));cookie=Response();cookie.set_cookie(COOKIE,signed,max_age=86400,httponly=True,samesite='strict',secure=limits.production);headers.extend(h for h in cookie.raw_headers if h[0]==b'set-cookie');headers.append((b'cache-control',b'no-store'))
                    if who.remaining_daily is not None:headers.extend([(b'x-ai-remaining-daily',str(who.remaining_daily).encode()),(b'x-ai-remaining-minute',str(who.remaining_minute).encode())])
                    message={**message,'headers':headers}
                await send(message)
            async def disconnect():
                await body_read.wait()
                return (await receive())['type']=='http.disconnect'
            task=asyncio.create_task(self.app(scope,replay,guarded_send));watch=asyncio.create_task(disconnect())
            try:
                done,_=await asyncio.wait({task,watch},return_when=asyncio.FIRST_COMPLETED)
                if task in done:await task
                elif await watch:
                    from app.observability import count
                    count('api_cancelled');task.cancel();await asyncio.gather(task,return_exceptions=True)
                else:await task
            finally:
                for pending in (task,watch):
                    if not pending.done():pending.cancel()
                await asyncio.gather(task,watch,return_exceptions=True)
                identity.reset(token)
        except (GovernanceError,ValueError) as e:
            code=e.code if isinstance(e,GovernanceError) else 'quota_unavailable';status=e.status if isinstance(e,GovernanceError) else 503
            response=JSONResponse({'detail':{'code':code,'message':localized(code,language)}},status,headers={'Retry-After':str(e.retry)} if isinstance(e,GovernanceError) and e.retry else None)
            if code=='invalid_session':response.delete_cookie(COOKIE)
            return await response(scope,receive,send)
    def __init__(self,app):self.app=app
