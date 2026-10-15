import math,copy,json,asyncio
import pytest,httpx
from app.experiments.registry import experiment
from app.experiments.optics import intensity,sinc,profile,detections
E=experiment('double-slit-interference')
def params():return copy.deepcopy(E.manifest['presets'][0]['parameters'])
@pytest.mark.parametrize('index',range(6))
def test_all_presets_finite_and_normalized(index):
    p=E.manifest['presets'][index]['parameters'];r=E.evaluate_query(p,{'events':500});assert r['observables']['central_intensity']==1 and r['observables']['probability_sum']==pytest.approx(1,abs=1e-12)
    assert all(math.isfinite(v) for v in r['state']['histogram'])

def test_independent_phase_zeros_symmetry_and_no_small_angle_substitution():
    p=params();assert sinc(0)==1 and intensity(p,0)==1
    for y in [.001,.01,.03]:assert intensity(p,y)==pytest.approx(intensity(p,-y),abs=1e-14)
    sn=p['wavelength']/(2*p['slitSeparation']);y=p['screenDistance']*sn/math.sqrt(1-sn*sn);assert intensity(p,y)<1e-25
    sn=p['wavelength']/p['slitWidth'];y=p['screenDistance']*sn/math.sqrt(1-sn*sn);assert intensity(p,y)<1e-25
    y=.5;sin=y/math.sqrt(p['screenDistance']**2+y*y);reference=math.cos(math.pi*p['slitSeparation']*sin/p['wavelength'])**2*(math.sin(math.pi*p['slitWidth']*sin/p['wavelength'])/(math.pi*p['slitWidth']*sin/p['wavelength']))**2
    assert intensity(p,y)==pytest.approx(reference,rel=1e-12)

def test_fringe_scaling_independent_central_limit():
    p=params();spacing=lambda q:E.evaluate_query(q,{'events':0})['observables']['central_fringe_spacing'];assert spacing(p)==pytest.approx(p['wavelength']*p['screenDistance']/p['slitSeparation'])
    assert spacing(dict(p,wavelength=p['wavelength']*1.2))/spacing(p)==pytest.approx(1.2)
    assert spacing(dict(p,slitSeparation=p['slitSeparation']/2))/spacing(p)==pytest.approx(2)
    sn=p['wavelength']/p['slitSeparation'];exact=p['screenDistance']*sn/math.sqrt(1-sn*sn);assert abs(exact/spacing(p)-1)<1e-5

def test_seed_reproducibility_and_histogram_convergence():
    p=params();p['detectionEvents']=5000;a=detections(p,5000);assert a==detections(p,5000) and a!=detections(dict(p,seed=43),5000)
    r=E.evaluate_query(p,{'events':5000});assert sum(r['state']['histogram'])==5000 and r['observables']['histogram_l1_error']<.15
    assert abs(r['observables']['sample_mean'])<.001

@pytest.mark.parametrize('patch',[{'wavelength':0},{'slitWidth':.001},{'slitSeparation':10e-6,'slitWidth':20e-6},{'slitSeparation':300e-6,'slitWidth':100e-6,'screenDistance':.5},{'seed':True},{'seed':1.5},{'detectionEvents':5001}])
def test_invalid_ranges_and_far_field_rejected(patch):
    with pytest.raises(ValueError):E.validate_parameters(dict(params(),**patch))

def test_query_context_bounded_and_verified():
    from app.experiments.context import context,verify,ExperimentContext
    for q in [{'time':1},{'events':5001},{'events':True},{'events':1.5}]:
        with pytest.raises(ValueError):E.evaluate_query(params(),q)
    c=context(E.id,params(),{'events':500});assert verify(c)==c
    assert len(c.model_dump_json())<6000
    data=c.model_dump();data['observables']['central_fringe_spacing']*=2
    with pytest.raises(ValueError):verify(ExperimentContext(**data))

def test_shared_action_lesson_and_governance_inheritance(monkeypatch):
    from app.experiments.ai import get_provider,action_adapter,apply
    from app.experiments.context import context
    from app.services.ai.provider import OpenAICompatibleProvider
    from app.services.ai.config import ProviderSettings
    from app.main import app
    calls=[]
    def transport(request):
        calls.append(1);return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':json.dumps({'scope':'in_scope','result':{'answer':'Finite slit width creates a diffraction envelope.','key_concepts':['Interference'],'related_equations':[]}})}}]})
    app.dependency_overrides[get_provider]=lambda:OpenAICompatibleProvider(ProviderSettings('mock-key','https://example.invalid','mock',1),httpx.MockTransport(transport))
    p=params();after=apply(E,p,[action_adapter.validate_python({'schema_version':1,'action':'scale_parameter','target':'slitSeparation','factor':2})]);assert after['slitSeparation']==pytest.approx(300e-6)
    monkeypatch.setenv('AI_DAILY','1')
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as client:
            c=context(E.id,p,{'events':0}).model_dump();payload=dict(context=c,preferred_language='en',prompt='Explain the envelope.')
            assert (await client.post('/api/v2/ai/explain',json=payload)).status_code==200
            payload['prompt']='Explain wavelength dependence.';assert (await client.post('/api/v2/ai/explain',json=payload)).status_code==429
            payload['prompt']='Write an unrelated marketing campaign.';assert (await client.post('/api/v2/ai/explain',json=payload)).status_code==422
    try:asyncio.run(run())
    finally:app.dependency_overrides.clear()
    assert len(calls)==1
