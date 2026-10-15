import copy,math
import pytest
from app.experiments.registry import experiment
from app.experiments.spatial import sample_field,step_size,advance
E=experiment('multi-zone-em')
def params():return copy.deepcopy(E.manifest['presets'][0]['parameters'])
def region(**kw):
    r=params()['regions'][0];r.update(kw);return r

def test_sampling_boundaries_outside_disabled_and_order():
    r=region();g=r['geometry'];a=copy.deepcopy(r);a.update(id='zone-b');a['electric_field']['y']=-20
    assert sample_field({'x':-6,'y':0},[r])['active']==[]
    assert sample_field({'x':-5,'y':-5},[r])['y']==100
    assert sample_field({'x':5,'y':0},[r])['y']==0
    assert sample_field({'x':0,'y':5},[r])['y']==0
    assert sample_field({'x':0,'y':0},[a,r])==sample_field({'x':0,'y':0},[r,a])
    assert sample_field({'x':0,'y':0},[a,r])['y']==80
    r['enabled']=False;assert sample_field({'x':0,'y':0},[r])['y']==0

@pytest.mark.parametrize('index',range(5))
def test_presets_finite_deterministic_and_magnetic_energy(index):
    p=copy.deepcopy(E.manifest['presets'][index]['parameters']);a=E.evaluate_query(p,{'time':p['duration']});b=E.evaluate_query(p,{'time':p['duration']})
    assert a==b and math.isfinite(a['state']['position']['x'])
    if index==3:assert a['observables']['speed']==pytest.approx(3,rel=1e-10)

@pytest.mark.parametrize('magnetic',[False,True])
def test_single_large_region_independent_analytical(magnetic):
    p=params();p['regions'][0]['geometry'].update(x=-50,y=-50,width=100,height=100);p['initialPosition']={'x':0,'y':0}
    r=p['regions'][0];r['electric_field']['y']=0 if magnetic else 100;r['magnetic_field']['z']=20 if magnetic else 0
    s=E.evaluate_query(p,{'time':2})['state'];w=.2
    if magnetic:
        assert s['position']['x']==pytest.approx(3*math.sin(w*2)/w,abs=1e-5)
        assert s['position']['y']==pytest.approx(3*(math.cos(w*2)-1)/w,abs=1e-5)
        assert math.hypot(*s['velocity'].values())==pytest.approx(3,rel=1e-12)
    else:
        assert s['position']==pytest.approx({'x':6,'y':2},abs=1e-10)
        assert s['velocity']==pytest.approx({'x':3,'y':2},abs=1e-10)

def narrow_reference(dt):
    p=params();p['initialPosition']={'x':-1,'y':0};p['initialVelocity']={'x':10,'y':0};p['timeStep']=dt;p['duration']=.3
    p['regions'][0]['geometry'].update(x=0,y=-50,width=.1,height=100)
    return E.evaluate_query(p,{'time':.25})['state']

def test_high_speed_narrow_slab_analytic_impulse_and_convergence():
    # vx=10 constant; entrance .1 s, exit .11 s, ay=1. Exact impulse .01 m/s.
    errors=[]
    for dt in [.001,.0005,.00025]:
        p=params();p['initialPosition']={'x':-1,'y':0};p['initialVelocity']={'x':10,'y':0};p['timeStep']=.001;p['duration']=.3;p['regions'][0]['geometry'].update(x=.003,y=-50,width=.101,height=100)
        # Direct smaller h independently of schema floor for convergence only.
        s={'time':0,'position':p['initialPosition'],'velocity':p['initialVelocity']}
        for _ in range(round(.25/dt)):s=advance(p,s,dt)
        errors.append(abs(s['velocity']['y']-.0101))
    assert errors[-1]<=errors[0]+1e-12 and errors[-1]<.00026
    s=narrow_reference(.001);assert s['velocity']['y']==pytest.approx(.01,abs=.0013)
    assert s['position']['x']==pytest.approx(1.5,abs=1e-11)

def test_adjacent_opposite_electric_continuity_and_impulses():
    p=copy.deepcopy(E.manifest['presets'][1]['parameters']);p['initialPosition']={'x':-1,'y':0};p['initialVelocity']={'x':2,'y':0};p['duration']=1
    left=E.evaluate_query(p,{'time':.5-1e-6})['state'];right=E.evaluate_query(p,{'time':.5+1e-6})['state']
    assert abs(left['position']['x']-right['position']['x'])<5e-6
    assert abs(left['velocity']['y']-right['velocity']['y'])<5e-6
    assert abs(E.evaluate_query(p,{'time':1})['state']['velocity']['y'])<.011

def test_superposition_combined_matches_independent_force():
    p=copy.deepcopy(E.manifest['presets'][4]['parameters']);p['initialPosition']={'x':0,'y':0};o=E.evaluate_query(p,{'time':0})['observables']
    assert o['acceleration']==pytest.approx({'x':0,'y':.4}) # q/m * (100 - 3*20)
    assert o['active_regions']==['zone-a','zone-b']

def test_zero_charge_and_corner():
    p=params();p['charge']=0;p['initialPosition']={'x':-6,'y':5}
    s=E.evaluate_query(p,{'time':2})['state'];assert s['position']==pytest.approx({'x':0,'y':5});assert s['velocity']=={'x':3,'y':0}

@pytest.mark.parametrize('mutation',['duplicate','size','world','bool','infinite','count','budget'])
def test_reject_invalid(mutation):
    p=params();r=p['regions'][0]
    if mutation=='duplicate':p['regions']*=2
    if mutation=='size':r['geometry']['width']=0
    if mutation=='world':r['geometry']['x']=100
    if mutation=='bool':r['schema_version']=True
    if mutation=='infinite':r['electric_field']['x']=math.inf
    if mutation=='count':p['regions']=[dict(r,id=f'z-{i}') for i in range(13)]
    if mutation=='budget':p['regions'].append(dict(copy.deepcopy(r),id='zone-b'));p['regions'][1]['geometry']['x']+=1e-8
    with pytest.raises(ValueError):E.validate_parameters(p)

def test_overlap_magnetic_superposition_cancels_and_sign_reverses_curvature():
    p=params();p['initialPosition']={'x':0,'y':0};r=p['regions'][0];r['electric_field']['y']=0;r['magnetic_field']['z']=20
    r2=copy.deepcopy(r);r2.update(id='zone-b');r2['magnetic_field']['z']=-20;p['regions'].append(r2)
    s=E.evaluate_query(p,{'time':1})['state'];assert s['position']==pytest.approx({'x':3,'y':0},abs=1e-12)
    p['regions'].pop();positive=E.evaluate_query(p,{'time':1})['state'];p['charge']*=-1;negative=E.evaluate_query(p,{'time':1})['state']
    assert positive['position']['y']==pytest.approx(-negative['position']['y'],abs=1e-12)

def test_boundary_magnetic_converges_to_independent_piecewise_circle():
    errors=[]
    for dt in [.02,.01,.005]:
        p=params();p.update(timeStep=dt,initialPosition={'x':-.5,'y':0});r=p['regions'][0];r['geometry'].update(x=0,y=-50,width=50,height=100);r['electric_field']['y']=0;r['magnetic_field']['z']=20
        t=1;tau=t-1/6;w=.2;s=E.evaluate_query(p,{'time':t})['state'];exact=(3*math.sin(w*tau)/w,3*(math.cos(w*tau)-1)/w)
        errors.append(math.hypot(s['position']['x']-exact[0],s['position']['y']-exact[1]))
    assert errors[1]<errors[0]*.3 and errors[2]<errors[1]*.3 and errors[-1]<1e-6

def test_cross_runtime_fixtures_and_independent_rejection():
    from app.experiments.context import context,verify,ExperimentContext
    p=params();c=context(E.id,p,{'time':1},3);assert verify(c)==c
    bad=c.model_dump();bad['observables']['active_regions']=['invented']
    with pytest.raises(ValueError):verify(ExperimentContext(**bad))

@pytest.mark.parametrize('action',[
    {'action':'add_field_region','region':dict(region(),id='zone-b')},
    {'action':'update_field_region','region_id':'zone-a','changes':{'magnetic_field':{'z':20}}},
    {'action':'move_field_region','region_id':'zone-a','x':-4,'y':-5},
    {'action':'resize_field_region','region_id':'zone-a','width':8,'height':10},
    {'action':'remove_field_region','region_id':'zone-a'},
    {'action':'toggle_field_region','region_id':'zone-a','enabled':False},
])
def test_region_actions_strict_atomic_and_no_source_mutation(action):
    from app.experiments.ai import action_adapter,apply
    p=params();before=copy.deepcopy(p);a=action_adapter.validate_python(dict(schema_version=1,**action));after=apply(E,p,[a]);assert p==before and after!=p
    with pytest.raises(ValueError):apply(experiment('lorentz-force-2d'),experiment('lorentz-force-2d').manifest['presets'][2]['parameters'],[a])

@pytest.mark.parametrize('a',[
 {'action':'move_field_region','region_id':'missing','x':1,'y':0},
 {'action':'resize_field_region','region_id':'zone-a','width':0,'height':10},
 {'action':'add_field_region','region':region()},
 {'action':'toggle_field_region','region_id':'zone-a','enabled':1},
 {'action':'update_field_region','region_id':'zone-a','changes':{'geometry':{'code':'evil'}}},
 {'action':'update_field_region','region_id':'zone-a','changes':{}},
 {'action':'move_field_region','region_id':'zone-a','x':200,'y':0},
])
def test_region_action_rejects_invalid_transition(a):
    from app.experiments.ai import action_adapter,apply
    with pytest.raises(ValueError):apply(E,params(),[action_adapter.validate_python(dict(schema_version=1,**a))])

def test_sequential_region_lesson_and_endpoint_mock():
    import asyncio,json
    import httpx
    from app.main import app
    from app.experiments.ai import get_provider,LessonDraft,enrich,validate_lesson
    from app.experiments.context import context
    from app.services.ai.config import ProviderSettings
    class Provider:
        settings=ProviderSettings('unused-test-key','https://example.invalid/','mock',30)
        async def _complete(self,messages,completion_limit):
            assert 'local_electric_field' in messages[1]['content'] and 'geometry' in messages[1]['content']
            return json.dumps(dict(status='proposal',action=dict(schema_version=1,action='update_field_region',region_id='zone-a',changes={'magnetic_field':{'z':20}}),explanation='Update the selected regional magnetic field.'))
    app.dependency_overrides[get_provider]=lambda:Provider()
    async def request():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://127.0.0.1') as client:
            response=await client.post('/api/v2/ai/plan-action',json=dict(context=context(E.id,params(),{'time':0}).model_dump(),prompt='Change selected magnetic field.',preferred_language='en'))
            assert response.status_code==200,response.text
            result=response.json();assert result['requires_confirmation'] is True and result['after']['regions'][0]['magnetic_field']['z']==20
    try:asyncio.run(request())
    finally:app.dependency_overrides.clear()
    step=dict(step_id='step-1',title='Change magnetic field',objective='Observe a boundary.',experiment_actions=[dict(schema_version=1,action='update_field_region',region_id='zone-a',changes={'magnetic_field':{'z':20}})],expected_behavior='Curvature in the region.',observation_question='How does it bend?',expected_concepts=['Local force'],explanation='The field is local.',completion_criteria='submit_observation')
    draft=LessonDraft.model_validate(dict(status='lesson',schema_version=2,title='Regional forces',language='en',learning_objectives=['Local force'],steps=[step]));plan=enrich(E,draft,params());assert validate_lesson(plan,E)==plan
    plan['steps'][0]['after']['regions'][0]['magnetic_field']['z']=30
    with pytest.raises(ValueError):validate_lesson(plan,E)

def test_combined_overlap_matches_independent_continuous_crossed_field_solution():
    p=params();p['initialPosition']={'x':0,'y':0};r=p['regions'][0];r['geometry'].update(x=-50,y=-50,width=100,height=100);r['electric_field'].update(x=10,y=20);r['magnetic_field']['z']=20
    t=2;w=.2;dx=1;dy=-.5;ux=2;uy=.5;c=math.cos(w*t);sn=math.sin(w*t);s=E.evaluate_query(p,{'time':t})['state']
    assert s['position']==pytest.approx({'x':dx*t+(ux*sn+uy*(1-c))/w,'y':dy*t+(uy*sn-ux*(1-c))/w},abs=1e-5)
    assert s['velocity']==pytest.approx({'x':dx+ux*c+uy*sn,'y':dy+uy*c-ux*sn},abs=1e-6)

def test_adjacent_opposite_magnetic_independent_two_arcs_and_continuity():
    p=copy.deepcopy(E.manifest['presets'][3]['parameters']);p['initialPosition']={'x':-1,'y':0};w=.2;tc=math.asin(w/3)/w
    left=E.evaluate_query(p,{'time':tc-1e-6})['state'];right=E.evaluate_query(p,{'time':tc+1e-6})['state']
    assert math.hypot(*(right['velocity'][k]-left['velocity'][k] for k in ['x','y']))<2e-6
    yc=3*(math.cos(w*tc)-1)/w;vx=3*math.cos(w*tc);vy=-3*math.sin(w*tc);tau=1-tc;w2=-w;sn=math.sin(w2*tau);c=math.cos(w2*tau)
    expected={'x':(vx*sn+vy*(1-c))/w2,'y':yc+(vy*sn-vx*(1-c))/w2}
    s=E.evaluate_query(p,{'time':1})['state'];assert s['position']==pytest.approx(expected,abs=2e-4)
    assert math.hypot(*s['velocity'].values())==pytest.approx(3,rel=1e-10)

def test_nonzero_charge_grazing_excluded_edge_and_corner_entry():
    p=params();p['regions'][0]['geometry'].update(x=0,y=0,width=5,height=5);p['initialPosition']={'x':-1,'y':5};p['initialVelocity']={'x':1,'y':0}
    assert E.evaluate_query(p,{'time':2})['state']['position']==pytest.approx({'x':1,'y':5},abs=1e-11)
    p['initialPosition']={'x':-1,'y':-1};p['initialVelocity']={'x':1,'y':1}
    s=E.evaluate_query(p,{'time':1.1})['state'];assert s['velocity']['y']==pytest.approx(1.1,abs=1e-10)
