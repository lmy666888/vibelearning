import copy,json,math,asyncio
from pathlib import Path
import pytest,httpx
from pydantic import ValidationError
from app.main import app
from app.experiments.registry import REGISTRY,experiment,MANIFESTS
from app.experiments.context import context,verify,ExperimentContext
from app.experiments.ai import get_provider,action_adapter,apply,LessonDraft,enrich,validate_lesson
from test_ai import SETTINGS,run,envelope
from app.services.ai.provider import OpenAICompatibleProvider

def params():return copy.deepcopy(experiment('lorentz-force-2d').manifest['presets'][2]['parameters'])
def exact_reference(p,t):
    q=p['charge'];m=p['mass'];w=q*p['magneticFieldZ']/m;x,y=p['initialPosition'].values();vx,vy=p['initialVelocity'].values()
    if w==0:return (x+vx*t+.5*q/m*p['field']['x']*t*t,y+vy*t+.5*q/m*p['field']['y']*t*t,vx+q/m*p['field']['x']*t,vy+q/m*p['field']['y']*t)
    dx=p['field']['y']/p['magneticFieldZ'];dy=-p['field']['x']/p['magneticFieldZ'];ux=vx-dx;uy=vy-dy;c=math.cos(w*t);s=math.sin(w*t)
    return x+dx*t+(ux*s+uy*(1-c))/w,y+dy*t+(uy*s-ux*(1-c))/w,dx+ux*c+uy*s,dy+uy*c-ux*s

def test_registry_manifest_is_canonical():
    assert set(REGISTRY)=={'uniform-electric-field','lorentz-force-2d'}
    assert [p.manifest for p in REGISTRY.values()]==MANIFESTS
    for e in REGISTRY.values():
        assert e.manifest['renderer'] and e.manifest['lesson_capabilities']
        for p in e.manifest['presets']:e.validate_parameters(p['parameters'])
@pytest.mark.parametrize('name,version',[('unknown',1),('lorentz-force-2d',2),('uniform-electric-field',True)])
def test_unknown_registration(name,version):
    with pytest.raises(ValueError):experiment(name,version)
@pytest.mark.parametrize('changes',[{'mass':0},{'charge':math.nan},{'magneticFieldZ':math.inf},{'magneticFieldZ':501},{'timeStep':0},{'duration':21},{'extra':1},{'magneticFieldZ':500,'timeStep':.02}])
def test_parameter_and_stability_limits(changes):
    p=params();p.update(changes)
    with pytest.raises(ValueError):experiment('lorentz-force-2d').validate_parameters(p)
@pytest.mark.parametrize('case',['no-fields','electric-only','positive-magnetic','negative-magnetic','crossed-fields','zero-charge'])
def test_independent_exact_reference(case):
    e=experiment('lorentz-force-2d');p=copy.deepcopy(next((s['parameters'] for s in e.manifest['presets'] if s['id']==case),params()))
    if case=='zero-charge':p['charge']=0
    t=7.3;r=e.evaluate(p,t);reference=exact_reference(p,t);s=r['state'];computed=[s['position']['x'],s['position']['y'],s['velocity']['x'],s['velocity']['y']]
    assert computed==pytest.approx(reference,abs=.00025 if p['magneticFieldZ'] else 1e-10)
@pytest.mark.parametrize('time',[.1,1,3,6,12,20])
def test_magnetic_energy_and_geometric_radius(time):
    e=experiment('lorentz-force-2d');p=params();r=e.evaluate(p,time);s=r['state'];o=r['observables']
    assert o['speed']==pytest.approx(3,rel=5e-10)
    assert math.hypot(s['position']['x'],s['position']['y']+3)==pytest.approx(3,abs=1e-10)
    assert o['kinetic_energy']==pytest.approx(.5*p['mass']*9,rel=5e-10)
    dot=o['magnetic_force']['x']*s['velocity']['x']+o['magnetic_force']['y']*s['velocity']['y'];assert dot==pytest.approx(0,abs=1e-18)
def test_charge_sign_and_field_doubling():
    e=experiment('lorentz-force-2d');p=params();r=e.evaluate(p,1);p['charge']*=-1;negative=e.evaluate(p,1)
    assert negative['state']['position']['y']==pytest.approx(-r['state']['position']['y'])
    p['charge']*=-1;p['magneticFieldZ']*=2;assert e.evaluate(p,0)['observables']['theoretical_radius']==pytest.approx(r['observables']['theoretical_radius']/2)
def test_force_components_and_exb_drift():
    e=experiment('lorentz-force-2d');p=params();p['field']={'x':1,'y':1};r=e.evaluate(p,0);o=r['observables']
    assert o['acceleration']==pytest.approx({'x':.1,'y':-2.9})
    t=4*math.pi;r=e.evaluate(p,t);assert r['state']['position']['x']/t==pytest.approx(.1,abs=3e-5);assert r['state']['position']['y']/t==pytest.approx(-.1,abs=3e-5)
def test_second_order_convergence_against_independent_continuous_solution():
    e=experiment('lorentz-force-2d');p=params();p['field']={'x':1,'y':1};t=10;ref=exact_reference(p,t);errors=[]
    for h in [.02,.01,.005]:
        p['timeStep']=h;r=e.evaluate(p,t)['state'];values=[r['position']['x'],r['position']['y'],r['velocity']['x'],r['velocity']['y']];errors.append(math.dist(values,ref))
    assert errors[1]<errors[0]*.26 and errors[2]<errors[1]*.26
@pytest.mark.parametrize('time',[-1,21,math.nan,math.inf,True])
def test_bounded_duration(time):
    with pytest.raises(ValueError):experiment('lorentz-force-2d').evaluate(params(),time)
def test_context_schema_and_derived_rejection():
    c=context('lorentz-force-2d',params(),{'time':1},3);assert verify(c)==c
    for change in [{'schema_version':True},{'experiment_version':2},{'experiment_id':'unknown'},{'snapshot_id':'wrong'},{'observables':{**c.observables,'speed':999}}]:
        data=c.model_dump();data.update(change)
        with pytest.raises(ValueError):verify(ExperimentContext.model_validate(data))
def test_shared_cross_runtime_fixture():
    fixtures=json.loads((Path(__file__).resolve().parents[2]/'shared/fixtures/experiment-contexts.json').read_text())
    for c in fixtures:verify(ExperimentContext.model_validate(c))
def test_cross_experiment_action_and_atomic_rejection():
    e=experiment('uniform-electric-field');p=e.manifest['presets'][0]['parameters'];saved=copy.deepcopy(p)
    with pytest.raises(ValueError):apply(e,p,[action_adapter.validate_python(dict(schema_version=1,action='set_parameter',target='magneticFieldZ',value=20))])
    assert p==saved

def draft():
    return LessonDraft.model_validate(dict(status='lesson',schema_version=2,title='Magnetic curvature',language='en',learning_objectives=['Compare charge polarity'],steps=[dict(step_id=f'step-{i+1}',title=f'Experiment {i+1}',objective='Observe curvature.',experiment_actions=[a],expected_behavior='Force is perpendicular to velocity.',observation_question='Which way does it curve?',expected_concepts=['Magnetic force'],explanation='Use q v cross B.',completion_criteria='submit_observation') for i,a in enumerate([dict(schema_version=1,action='select_preset',preset_id='positive-magnetic'),dict(schema_version=1,action='set_parameter',target='charge',value=-1e-8),dict(schema_version=1,action='scale_parameter',target='magneticFieldZ',factor=2)])]))
def test_sequential_lesson_and_cross_experiment_rejection():
    e=experiment('lorentz-force-2d');plan=enrich(e,draft(),params());validate_lesson(plan,e)
    assert [s['predicted_observables']['theoretical_radius'] for s in plan['steps']]==pytest.approx([3,3,1.5])
    assert plan['steps'][2]['before']==plan['steps'][1]['after']
    with pytest.raises(ValueError):validate_lesson(plan,experiment('uniform-electric-field'))
    plan['steps'][2]['requires_confirmation']=False
    with pytest.raises(ValueError):validate_lesson(plan,e)

@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    app.dependency_overrides.clear();monkeypatch.delenv('LLM_API_KEY',raising=False);monkeypatch.delenv('LLM_MODEL',raising=False)
    yield
    app.dependency_overrides.clear()
def post(operation,body,host='127.0.0.1',headers=None):
    async def send():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app,client=(host,123)),base_url='http://test') as c:return await c.post('/api/v2/ai/'+operation,json=body,headers=headers)
    return run(send())
def request():return dict(context=context('lorentz-force-2d',params(),{'time':0},0).model_dump(),prompt='Double the magnetic field.',preferred_language='en')
def provider(payload,status=200):return OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(lambda _:httpx.Response(status,json=envelope(payload))))
def test_shared_ai_explanation_and_action():
    payload={'status':'proposal','action':{'schema_version':1,'action':'scale_parameter','target':'magneticFieldZ','factor':2},'explanation':'Double the magnetic field.'}
    app.dependency_overrides[get_provider]=lambda:provider(payload)
    r=post('plan-action',request());assert r.status_code==200
    assert r.json()['after_observables']['theoretical_radius']==pytest.approx(1.5) and r.json()['requires_confirmation'] is True
    app.dependency_overrides[get_provider]=lambda:provider(dict(answer='Magnetic force is perpendicular to velocity and does no work.',key_concepts=['Magnetic force'],related_equations=['F=q(E+v×B)']))
    assert post('explain',request()).status_code==200

def test_shared_ai_lesson_and_observation():
    app.dependency_overrides[get_provider]=lambda:provider(draft().model_dump());r=post('generate-lesson',request());assert r.status_code==200
    plan=r.json();data=request();data.update(lesson=plan,step_id='step-1',prompt='It curves downward at constant speed.');data['context']=context('lorentz-force-2d',plan['steps'][0]['after'],{'time':1}).model_dump()
    app.dependency_overrides[get_provider]=lambda:provider(dict(assessment='correct',feedback='Correct observation.',explanation='Magnetic force does no work.',hint=None,next_action='continue'))
    r=post('evaluate-observation',data);assert r.status_code==200 and r.json()['assessment']=='correct'
@pytest.mark.parametrize('status,expected',[(401,502),(429,429),(500,502)])
def test_provider_errors_safe(status,expected):
    app.dependency_overrides[get_provider]=lambda:provider({'private':'private-debug'},status)
    r=post('explain',request());assert r.status_code==expected and 'private-debug' not in r.text

def test_guards_configuration_and_invalid_context_before_provider_call():
    assert post('explain',request()).status_code==503
    app.dependency_overrides[get_provider]=lambda:provider({})
    assert post('explain',request(),host='203.0.113.1').status_code==403
    assert post('explain',request(),headers={'Origin':'https://evil.example'}).status_code==403
    data=request();data['context']['experiment_id']='uniform-electric-field';assert post('plan-action',data).status_code==422

def test_static_nonparticle_plugin_works_through_generic_context_and_actions(monkeypatch):
    class Static:
        id='test-static';version=1
        manifest=dict(id=id,version=version,parameters=[dict(target='slope',min=0,max=10,scale=1)],operations=['set_parameter'],initial_query={'input':0},presets=[])
        def validate_parameters(self,p):
            if set(p)!={'slope'} or type(p['slope']) not in (int,float) or not 0<=p['slope']<=10:raise ValueError('Invalid slope')
            return p.copy()
        def evaluate_query(self,p,q):
            if set(q)!={'input'} or type(q['input']) not in (float,int):raise ValueError('Invalid query')
            return dict(state=dict(result=p['slope']*q['input']),observables=dict(output=p['slope']*q['input']))
    monkeypatch.setitem(REGISTRY,'test-static',Static())
    c=context('test-static',{'slope':2},{'input':3});assert verify(c).observables=={'output':6}
    assert apply(REGISTRY['test-static'],{'slope':2},[action_adapter.validate_python(dict(schema_version=1,action='set_parameter',target='slope',value=3))])=={'slope':3}

def test_context_version_one_is_not_silently_reinterpreted():
    from test_ai import context as legacy
    with pytest.raises(ValidationError):ExperimentContext.model_validate(legacy())

def test_v2_request_limit():
    app.dependency_overrides[get_provider]=lambda:provider({})
    async def send():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app,client=('127.0.0.1',123)),base_url='http://test') as c:return await c.post('/api/v2/ai/explain',content='x'*65537)
    assert run(send()).status_code==413

def test_neutral_particle_has_no_guiding_center_drift_and_no_acceleration():
    e=experiment('lorentz-force-2d');p=params();p.update(charge=0,field={'x':1,'y':1});o=e.evaluate(p,2)['observables']
    assert o['acceleration']=={'x':0,'y':0} and o['drift_velocity'] is None and o['theoretical_radius'] is None

def test_language_policy_allows_only_registered_technical_identifiers():
    from app.services.ai.language import ensure_language
    ids=['positive-magnetic','magnetic_force']
    ensure_language(['选择 positive-magnetic 预设；magnetic_force 与速度垂直。'],'zh-CN',ids)
    from app.services.ai.provider import ProviderError
    with pytest.raises(ProviderError):ensure_language(['磁场中的 magnetic force perpendicular to velocity。'],'zh-CN',ids)

def test_v2_rejects_untranslated_concepts_safely():
    from app.services.ai.provider import ProviderError
    data=request();data['preferred_language']='zh-CN';app.dependency_overrides[get_provider]=lambda:provider(dict(answer='磁场不做功。',key_concepts=['magnetic force perpendicular to velocity'],related_equations=['F=q(v×B)']))
    r=post('explain',data);assert r.status_code==502 and r.json()['detail']['code']=='language_mismatch'

def test_v2_provider_timeout():
    def fail(_):raise httpx.ReadTimeout('private-transport-debug')
    app.dependency_overrides[get_provider]=lambda:OpenAICompatibleProvider(SETTINGS,httpx.MockTransport(fail))
    r=post('explain',request());assert r.status_code==504 and 'private-transport-debug' not in r.text

def test_v2_equations_are_registered_science_not_model_generated_math():
    app.dependency_overrides[get_provider]=lambda:provider(dict(answer='The magnetic force is perpendicular to velocity.',key_concepts=['Magnetic force'],related_equations=['incorrect equation']))
    r=post('explain',request());assert r.status_code==200
    assert r.json()['related_equations']==experiment('lorentz-force-2d').manifest['equations']

def test_context_is_deeply_immutable_but_serializes_as_normal_json():
    c=context('lorentz-force-2d',params(),{'time':0},3)
    with pytest.raises(TypeError):c.parameters['mass']=0
    with pytest.raises(TypeError):c.parameters['field']['x']=99
    with pytest.raises(TypeError):c.observables.update(speed=999)
    data=c.model_dump();data['parameters']['mass']=2e-7
    assert c.parameters['mass']==1e-7
    assert ExperimentContext.model_validate_json(c.model_dump_json())==c
