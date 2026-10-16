import asyncio,json,subprocess,sys,importlib.util
from pathlib import Path
import pytest,httpx
from app.main import app
from app.observability import snapshot,COUNTS,LOCK
from app.governance import gateway
from app.governance.quota import Limits,MemoryStore,specs_for,GovernanceError
from app.services.ai.provider import OpenAICompatibleProvider,ProviderError
from test_ai import SETTINGS
ROOT=Path(__file__).parents[2]
def run(coro):return asyncio.run(coro)
def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def test_scientific_manifest_and_reproducible_independent_references():
    from app.experiments.registry import REGISTRY
    files=list((ROOT/'shared/scientific').glob('*.json'));assert len(files)==6
    for f in files:
        m=json.loads(f.read_text());assert m['experiment_id'] in REGISTRY;assert m['valid_parameter_domain']==REGISTRY[m['experiment_id']].manifest['parameters'];assert m['numerical_tolerances'] and m['reference_equations'] and m['conservation_laws'] and m['known_limitations']
    report=module('validate_science').validate();assert report['status']=='passed';assert set(report['experiments'])==set(REGISTRY)

def test_336_evaluation_corpus_and_honest_preflight_metrics():
    rows=json.loads((ROOT/'shared/security/release-evaluation.json').read_text())['cases'];assert len(rows)>=300;assert len({(r['experiment_id'],r['category'],r['prompt']) for r in rows})==len(rows)
    assert len({r['category'] for r in rows})==8 and {r['language'] for r in rows}=={'en','zh-CN'}
    r=module('evaluate_ai').offline();assert r['unauthorized_action_execution']==0 and r['unauthorized_action_attempts']==252;assert r['semantic_required']>0;assert r['in_scope_recall']==1 and r['false_rejection_rate']==0
    # Deliberately not a fake perfect classifier: many out-of-scope cases still need semantic routing.
    assert r['false_acceptance_candidate_rate']>0 and 'NOT Gemini' in r['method']

def test_live_evaluation_refuses_large_budget_before_credentials_or_dispatch():
    r=subprocess.run([sys.executable,str(ROOT/'scripts/evaluate_ai.py'),'--live','--requests','4'],capture_output=True,text=True);assert r.returncode==2;assert 'Hard safety cap' in r.stderr

def test_kill_switch_blocks_every_new_dispatch_and_health_stays_available(monkeypatch):
    monkeypatch.setenv('AI_ENABLED','false');calls=[]
    async def send(*a):calls.append(1);return '{}',None
    with pytest.raises(ProviderError) as error:run(gateway.completion(OpenAICompatibleProvider(SETTINGS),[],100,send))
    assert error.value.code=='ai_disabled' and calls==[]
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as c:
            assert (await c.get('/api/live')).status_code==200;assert (await c.get('/api/ready')).status_code==200
    run(check())

def test_metrics_auth_bounded_labels_and_no_sensitive_text(monkeypatch):
    monkeypatch.setenv('OPS_METRICS_TOKEN','x'*40)
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as c:
            assert (await c.get('/api/ops/metrics')).status_code==404
            await c.get('/arbitrary/prompt-secret-identifier')
            r=await c.get('/api/ops/metrics',headers={'Authorization':'Bearer '+'x'*40});assert r.status_code==200
            s=r.text;assert 'prompt-secret-identifier' not in s and 'session' not in s and 'Bearer' not in s
            assert r.json()['counters']['api_requests']>=1
    run(check())

def test_frontend_telemetry_rejects_raw_errors_unknown_experiments_and_large_bodies():
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as c:
            b=dict(kind='runtime',experiment_id='momentum-collisions');headers={'Origin':'http://127.0.0.1:5173'}
            assert (await c.post('/api/telemetry/client-error',json=b)).status_code==403
            assert (await c.post('/api/telemetry/client-error',json=b,headers=headers)).status_code==202
            assert (await c.post('/api/telemetry/client-error',json={**b,'message':'private prompt'},headers=headers)).status_code==422
            assert (await c.post('/api/telemetry/client-error',json={**b,'experiment_id':'private-id'},headers=headers)).status_code==422
            assert (await c.post('/api/telemetry/client-error',content='x'*257,headers=headers)).status_code==413
    run(check())

def test_production_readiness_fail_closed_and_liveness_not_dependency_bound(monkeypatch):
    monkeypatch.setenv('AI_ENV','production');monkeypatch.delenv('AI_SESSION_SECRET',raising=False);monkeypatch.delenv('FRONTEND_ORIGINS',raising=False)
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as c:
            assert (await c.get('/api/live')).status_code==200;r=await c.get('/api/ready');assert r.status_code==503;assert 'https_origins_required' in r.json()['checks'];assert 'secret' not in r.text or 'metrics_secret_required' in r.text
    run(check())

def test_parallel_global_budget_is_reserved_before_dispatch_and_not_refunded_on_failure():
    async def check():
        store=MemoryStore();limits=Limits(global_daily=3,concurrency=100,minute=100,network_minute=100)
        async def reserve(i):
            import time
            specs,cost=specs_for(limits,'session','network',str(i),50,100)
            try:return await store.reserve(specs,str(i),time.time()+30,100,cost,specs[-1][0])
            except GovernanceError:return None
        admitted=[r for r in await asyncio.gather(*(reserve(i) for i in range(30))) if r];assert len(admitted)==3
        for r in admitted:await store.finish(r,failed=True)
        assert not store.leases and await reserve(100) is None
    run(check())

def test_cancelled_provider_releases_lease_and_retains_reserved_budget(monkeypatch):
    store=MemoryStore();monkeypatch.setattr(gateway,'store_for',lambda _:store)
    async def check():
        started=asyncio.Event()
        async def send(*a):started.set();await asyncio.Event().wait()
        task=asyncio.create_task(gateway.completion(OpenAICompatibleProvider(SETTINGS),[],100,send));await started.wait();task.cancel()
        with pytest.raises(asyncio.CancelledError):await task
        await asyncio.sleep(.01);assert not store.leases;assert any(':cost:' in k for k in store.counts)
    run(check())

@pytest.mark.parametrize('experiment_id',['uniform-electric-field','lorentz-force-2d','multi-zone-em','double-slit-interference','kepler-orbital-mechanics','momentum-collisions'])
@pytest.mark.parametrize('language',['en','zh-CN'])
@pytest.mark.parametrize('wire_kind',['valid','malformed','wrong_language','secret_echo'])
def test_bilingual_mock_output_contract(experiment_id,language,wire_kind):
    from app.experiments.registry import experiment
    from app.experiments.context import context
    from app.experiments.ai import get_provider
    e=experiment(experiment_id);answer='The verified model predicts this observation.' if language=='en' else '该实验的观察结果符合已验证的科学模型。'
    concept='Scientific model' if language=='en' else '科学模型'
    if wire_kind=='wrong_language':answer='该实验的观察结果符合已验证的科学模型。' if language=='en' else 'The verified model predicts this observation.'
    if wire_kind=='secret_echo':answer+=' '+SETTINGS.api_key
    content='not JSON' if wire_kind=='malformed' else json.dumps(dict(scope='in_scope',result=dict(answer=answer,key_concepts=[concept],related_equations=[])),ensure_ascii=False)
    app.dependency_overrides[get_provider]=lambda:OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(lambda _:httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':content}}]})))
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as c:
            r=await c.post('/api/v2/ai/explain',json=dict(context=context(e.id,e.manifest['presets'][0]['parameters'],e.manifest['initial_query']).model_dump(),preferred_language=language,prompt='Explain this observation.' if language=='en' else '请解释这个实验现象。'))
            assert r.status_code==(200 if wire_kind=='valid' else 502)
            assert SETTINGS.api_key not in r.text
    try:run(check())
    finally:app.dependency_overrides.clear()

def test_forged_forwarding_headers_do_not_reset_network_quota(monkeypatch):
    from app.experiments.registry import experiment
    from app.experiments.context import context
    from app.experiments.ai import get_provider
    monkeypatch.setenv('AI_NETWORK_MINUTE','1');calls=[]
    def send(_):
        calls.append(1);return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':json.dumps(dict(scope='in_scope',result=dict(answer='The physical model predicts this observation.',key_concepts=['Scientific model'],related_equations=[])))}}]})
    app.dependency_overrides[get_provider]=lambda:OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(send))
    async def check():
        e=experiment('momentum-collisions');body=dict(context=context(e.id,e.manifest['presets'][0]['parameters'],e.manifest['initial_query']).model_dump(),prompt='Explain momentum.',preferred_language='en')
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as c:
            assert (await c.post('/api/v2/ai/explain',json=body,headers={'X-Forwarded-For':'1.2.3.4'})).status_code==200
            body['prompt']='Explain energy.';r=await c.post('/api/v2/ai/explain',json=body,headers={'X-Forwarded-For':'8.8.8.8'});assert r.status_code==429 and len(calls)==1
    try:run(check())
    finally:app.dependency_overrides.clear()

def test_early_policy_errors_are_in_api_metrics():
    before=snapshot()['counters'].get('api_errors',0)
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as c:
            r=await c.post('/api/ai/explain',json={'question':'Write an unrelated marketing campaign.'});assert r.status_code==422
    run(check());assert snapshot()['counters']['api_errors']>=before+1

def test_kill_switch_flipped_after_reservation_still_prevents_network_and_refunds_cost(monkeypatch):
    import os
    class Flip(MemoryStore):
        async def reserve(self,*args):
            r=await super().reserve(*args);monkeypatch.setenv('AI_ENABLED','false');return r
    store=Flip();monkeypatch.setenv('AI_ENABLED','true');monkeypatch.setattr(gateway,'store_for',lambda _:store);calls=[]
    async def send(*a):calls.append(1);return '{}',None
    with pytest.raises(ProviderError) as error:run(gateway.completion(OpenAICompatibleProvider(SETTINGS),[],100,send))
    assert error.value.code=='ai_disabled' and calls==[] and not store.leases
    assert all(value==0 for key,(value,_) in store.counts.items() if ':cost:' in key)

def test_actual_http_disconnect_cancels_upstream_and_releases_lease(monkeypatch):
    from app.experiments.registry import experiment
    from app.experiments.context import context
    from app.experiments.ai import get_provider
    from app.governance import quota
    async def check():
        started=asyncio.Event();cancelled=asyncio.Event()
        async def provider_send(request):
            started.set()
            try:await asyncio.Event().wait()
            except asyncio.CancelledError:cancelled.set();raise
        app.dependency_overrides[get_provider]=lambda:OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(provider_send))
        e=experiment('momentum-collisions');body=json.dumps(dict(context=context(e.id,e.manifest['presets'][0]['parameters'],e.manifest['initial_query']).model_dump(),preferred_language='en',prompt='Explain momentum.')).encode();read=False
        async def receive():
            nonlocal read
            if not read:read=True;return {'type':'http.request','body':body,'more_body':False}
            await started.wait();return {'type':'http.disconnect'}
        async def send(message):pass
        scope=dict(type='http',asgi={'version':'3.0'},http_version='1.1',method='POST',scheme='http',path='/api/v2/ai/explain',raw_path=b'/api/v2/ai/explain',query_string=b'',root_path='',headers=[(b'content-type',b'application/json')],client=('127.0.0.1',1),server=('127.0.0.1',8000))
        await asyncio.wait_for(app(scope,receive,send),2);await asyncio.sleep(.01);assert cancelled.is_set() and not quota.memory.leases
    try:run(check())
    finally:app.dependency_overrides.clear()
