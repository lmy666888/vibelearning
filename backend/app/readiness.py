"""Safe production readiness. No network generation or secret values in health responses."""
import os
from urllib.parse import urlsplit
from fastapi import APIRouter
from starlette.responses import JSONResponse
from app.governance.quota import Limits
router=APIRouter()
def ai_enabled():return os.getenv('AI_ENABLED','true').lower() in {'true','1'}
async def checks():
    errors=[]
    if os.getenv('AI_ENV')=='production':
        origins=os.getenv('FRONTEND_ORIGINS','')
        def valid(value):
            try:
                u=urlsplit(value);port=u.port
                return u.scheme=='https' and bool(u.hostname) and not(u.username or u.password or u.query or u.fragment or u.path)
            except ValueError:return False
        if not origins or not all(valid(o.strip()) for o in origins.split(',')):errors.append('https_origins_required')
        if os.getenv('AI_ENABLED','true').lower() not in {'true','false','1','0'}:errors.append('invalid_ai_switch')
        if len(os.getenv('OPS_METRICS_TOKEN',''))<32:errors.append('metrics_secret_required')
        if ai_enabled():
            try:
                limits=Limits.load()
                from app.services.ai.config import ProviderSettings
                settings=ProviderSettings.from_environment()
                if not settings.base_url.startswith('https://'):errors.append('https_provider_required')
                from redis.asyncio import Redis
                async with Redis.from_url(limits.redis_url,socket_connect_timeout=1,socket_timeout=1) as client:await client.ping()
            except Exception:errors.append('ai_dependencies_unavailable')
    return errors
@router.get('/live')
async def live():return {'status':'alive'}
@router.get('/ready')
async def ready():
    errors=await checks()
    return JSONResponse({'status':'not_ready' if errors else 'ready','ai_enabled':ai_enabled(),'checks':errors},status_code=503 if errors else 200,headers={'Cache-Control':'no-store'})
