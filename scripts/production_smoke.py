"""Production-mode ASGI + real dedicated Redis, mocked upstream only. No real key/generation needed."""
import os,sys,json,asyncio,secrets,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'backend'))
async def smoke(url):
    # Dedicated smoke DB must be distinct from test/production DB; do not flush user data.
    from urllib.parse import urlsplit
    parsed=urlsplit(url)
    if parsed.hostname not in {'127.0.0.1','localhost'} or parsed.path!='/14':raise ValueError('Use isolated loopback Redis DB14 for this smoke run')
    os.environ.update(AI_ENV='production',AI_ENABLED='true',AI_REDIS_URL=url,AI_SESSION_SECRET=secrets.token_hex(32),OPS_METRICS_TOKEN=secrets.token_hex(32),AI_INPUT_PRICE='2',AI_OUTPUT_PRICE='10',FRONTEND_ORIGINS='https://beta.example.test',LLM_API_KEY='smoke-placeholder',LLM_MODEL='mock',LLM_BASE_URL='https://example.invalid/v1')
    import httpx
    from app.main import app
    from app.experiments.registry import experiment
    from app.experiments.context import context
    from app.experiments.ai import get_provider
    from app.services.ai.provider import OpenAICompatibleProvider
    from app.services.ai.config import ProviderSettings
    calls=[]
    def send(_):
        calls.append(1);return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':json.dumps(dict(scope='in_scope',result=dict(answer='The verified physical model explains this observation.',key_concepts=['Scientific model'],related_equations=[])))}}],'usage':dict(prompt_tokens=100,completion_tokens=40)})
    app.dependency_overrides[get_provider]=lambda:OpenAICompatibleProvider(ProviderSettings('smoke-placeholder','https://example.invalid','mock',2),httpx.MockTransport(send))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='https://beta.example.test') as client:
        assert (await client.get('/api/live')).status_code==200;assert (await client.get('/api/ready')).status_code==200
        e=experiment('momentum-collisions');body=dict(context=context(e.id,e.manifest['presets'][0]['parameters'],e.manifest['initial_query']).model_dump(),prompt='Explain this observation.',preferred_language='en')
        r=await client.post('/api/v2/ai/explain',json=body,headers={'Origin':'https://beta.example.test'});assert r.status_code==200,r.status_code;assert 'Secure' in r.headers['set-cookie'] and 'HttpOnly' in r.headers['set-cookie']
        os.environ['AI_ENABLED']='false';body['prompt']='Explain momentum.';r=await client.post('/api/v2/ai/explain',json=body,headers={'Origin':'https://beta.example.test'});assert r.status_code==503 and len(calls)==1
        assert (await client.get('/api/ready')).status_code==200
        metrics=await client.get('/api/ops/metrics',headers={'Authorization':'Bearer '+os.environ['OPS_METRICS_TOKEN']});assert metrics.status_code==200
        assert metrics.json()['counters']['provider_calls']==1
    app.dependency_overrides.clear()
    return dict(status='passed',transport='real ASGI, production policy and real Redis; upstream mocked',readiness=200,secure_cookie=True,kill_switch=503,upstream_mock_calls=len(calls),real_provider_calls=0)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--redis-url',default='redis://127.0.0.1:6397/14');p.add_argument('--output');a=p.parse_args();s=json.dumps(asyncio.run(smoke(a.redis_url)),indent=2)
    if a.output:Path(a.output).write_text(s+'\n')
    else:print(s)
