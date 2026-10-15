import copy,math,json
from pathlib import Path
import pytest
from app.experiments.registry import experiment
from app.experiments.collisions import impact,dot,add
E=experiment('momentum-collisions')
def params(i=0):return copy.deepcopy(E.manifest['presets'][i]['parameters'])
@pytest.mark.parametrize('ma,mb,ua,ub,e',[(1,1,2,-2,1),(3,1,2,-1,1),(1,2,2,0,.5),(.1,10,3,-1,.2),(2,1,2,0,0),(1,1,-2,2,1)])
def test_independent_1d_analytical_solutions(ma,mb,ua,ub,e):
    p=params();p.update(massA=ma,massB=mb,velocityA=dict(x=ua,y=0),velocityB=dict(x=ub,y=0),restitution=e,duration=10)
    if ua<ub:p['positionA'],p['positionB']=p['positionB'],p['positionA']
    r=E.evaluate_query(p,{'time':10});o=r['observables'];a=o['post_velocityA']['x'];b=o['post_velocityB']['x']
    # Independent COM-relative decomposition, rather than production rational formula.
    V=(ma*ua+mb*ub)/(ma+mb);assert a==pytest.approx(V-e*mb/(ma+mb)*(ua-ub),abs=1e-12);assert b==pytest.approx(V+e*ma/(ma+mb)*(ua-ub),abs=1e-12)
    assert ma*a+mb*b==pytest.approx(ma*ua+mb*ub,abs=1e-12);assert b-a==pytest.approx(-e*(ub-ua),abs=1e-12)
    assert o['predicted_energy_loss']==pytest.approx(.5*ma*mb/(ma+mb)*(1-e*e)*(ua-ub)**2,abs=1e-11)
    assert o['kinetic_energy']<=o['initial_energy']+1e-11
    if e==1:assert o['kinetic_energy']==pytest.approx(o['initial_energy'],abs=1e-11)

def test_equal_mass_exchange_and_stationary_target():
    event=impact(params());assert event['postA']==dict(x=-2,y=0);assert event['postB']==dict(x=2,y=0)
    event=impact(params(2));assert event['postA']==dict(x=0,y=0);assert event['postB']==dict(x=2,y=0)

def test_oblique_2d_independent_contact_normal_impulse():
    p=params(5);p['positionA']['y']=.6;event=impact(p)
    assert event['time']==pytest.approx(1.1,abs=1e-12);assert event['normal']==pytest.approx(dict(x=.8,y=-.6),abs=1e-12)
    assert event['postA']==pytest.approx(dict(x=.72,y=.96),abs=1e-12);assert event['postB']==pytest.approx(dict(x=1.28,y=-.96),abs=1e-12)
    tangent=dict(x=.6,y=.8)
    for before,after in [(p['velocityA'],event['postA']),(p['velocityB'],event['postB'])]:assert dot(before,tangent)==pytest.approx(dot(after,tangent),abs=1e-12)
    o=E.evaluate_query(p,{'time':3})['observables'];assert o['momentum']==pytest.approx(dict(x=2,y=0),abs=1e-12);assert o['kinetic_energy']==pytest.approx(2,abs=1e-12)

@pytest.mark.parametrize('e',[0,.5,1])
def test_normal_restitution_energy_loss_and_2d_nonbinding(e):
    p=params(5);p['restitution']=e;event=impact(p);assert event['normal_after']==pytest.approx(-e*event['normal_before'],abs=1e-12)
    r=E.evaluate_query(p,{'time':p['duration']});o=r['observables'];expected=.5*p['massA']*p['massB']/(p['massA']+p['massB'])*(1-e*e)*event['normal_before']**2
    assert o['energy_loss']==pytest.approx(expected,abs=1e-12);assert o['momentum_error']<1e-12
    if e==0:
        d=add(r['state']['positionB'],r['state']['positionA'],-1);assert math.hypot(d['x'],d['y'])>p['radiusA']+p['radiusB']

def test_1d_perfectly_inelastic_pair_remains_in_contact():
    p=params(4);r=E.evaluate_query(p,{'time':5})['state'];assert r['velocityA']==r['velocityB']==dict(x=1,y=0);assert r['positionB']['x']-r['positionA']['x']==pytest.approx(1,abs=1e-12)

def test_continuous_impact_prevents_high_speed_tunneling():
    p=params();p.update(radiusA=.1,radiusB=.1,positionA=dict(x=-.2,y=0),positionB=dict(x=.2,y=0),velocityA=dict(x=20,y=0),velocityB=dict(x=-20,y=0));event=impact(p);assert event['time']==pytest.approx(.005,abs=1e-14)
    for t in [.004,.005,.05,4]:
        r=E.evaluate_query(p,{'time':t})['state'];assert r['collision_count']==int(t>=.005);assert r['positionA']['x']<r['positionB']['x'];assert r==E.evaluate_query(p,{'time':t})['state']
    # Exactly touching and approaching collides at zero; separating does not receive an impulse.
    p['positionA']['x']=-.1;p['positionB']['x']=.1;assert impact(p)['time']==0
    p['velocityA']['x']=-20;p['velocityB']['x']=20;assert impact(p) is None

@pytest.mark.parametrize('kind',['tangent','miss','separate','static','short-window'])
def test_nonimpact_conditions_have_no_false_events(kind):
    p=params(5)
    if kind=='tangent':p['positionA']['y']=1
    if kind=='miss':p['positionA']['y']=1.01
    if kind=='separate':p['velocityA']['x']=-2
    if kind=='static':p['velocityA']['x']=0
    if kind=='short-window':p['duration']=.1
    r=E.evaluate_query(p,{'time':p['duration']});assert r['state']['event'] is None;assert r['state']['collision_count']==0;assert r['observables']['predicted_energy_loss']==0

def test_galilean_invariance_and_com_transform():
    p=params(5);q=copy.deepcopy(p);boost=dict(x=1,y=-.5)
    for k in ['velocityA','velocityB']:q[k]=add(q[k],boost)
    a=E.evaluate_query(p,{'time':2});b=E.evaluate_query(q,{'time':2});assert a['state']['event']['time']==pytest.approx(b['state']['event']['time'],abs=1e-12)
    for tag in ['A','B']:
        assert b['state']['velocity'+tag]==pytest.approx(add(a['state']['velocity'+tag],boost),abs=1e-12)
        assert b['state']['position'+tag]==pytest.approx(add(a['state']['position'+tag],boost,2),abs=1e-12)
    p['frame']=q['frame']=1;a=E.evaluate_query(p,{'time':2});b=E.evaluate_query(q,{'time':2})
    for tag in ['A','B']:assert a['state']['display'+tag]==pytest.approx(b['state']['display'+tag],abs=1e-12)
    assert a['observables']['display_momentum']==pytest.approx(dict(x=0,y=0),abs=1e-12)
    P=a['observables']['momentum'];K=a['observables']['kinetic_energy'];assert a['observables']['display_kinetic_energy']==pytest.approx(K-dot(P,P)/(2*(p['massA']+p['massB'])),abs=1e-12)

@pytest.mark.parametrize('patch',[{'massA':0},{'radiusB':-1},{'restitution':1.01},{'frame':.5},{'dimensions':1.5},{'duration':math.inf},{'positionA':dict(x=3,y=0)},{'velocityA':dict(x=1,y=.1)},{'extra':1}])
def test_invalid_inputs(patch):
    with pytest.raises(ValueError):E.validate_parameters(dict(params(),**patch))
@pytest.mark.parametrize('t',[-1,21,True,math.nan])
def test_invalid_query(t):
    with pytest.raises(ValueError):E.evaluate_query(params(),{'time':t})

def test_actions_contexts_and_all_presets():
    from app.experiments.ai import apply,action_adapter
    from app.experiments.context import context,verify,ExperimentContext
    p=params();a=action_adapter.validate_python({'schema_version':1,'action':'scale_parameter','target':'massA','factor':2});q=apply(E,p,[a]);assert q['massA']==2
    for preset in E.manifest['presets']:
        p=E.validate_parameters(preset['parameters'])
        for t in [0,p['duration']/2,p['duration']]:assert verify(context(E.id,p,dict(time=t)))==context(E.id,p,dict(time=t))
    fixtures=json.loads((Path(__file__).parents[2]/'shared/fixtures/collision-contexts.json').read_text())
    for c in fixtures:assert verify(ExperimentContext.model_validate(c)).experiment_id==E.id

def test_extreme_allowed_2d_mass_ratio_and_small_disks_at_large_separation():
    # Independent geometric chord, at max initial separation/speed and min radius.
    for ma,mb in [(.1,10),(10,.1)]:
        for e in [0,.5,1]:
            p=params(5);p.update(massA=ma,massB=mb,radiusA=.1,radiusB=.1,positionA=dict(x=-20,y=.1),positionB=dict(x=20,y=0),velocityA=dict(x=20,y=0),velocityB=dict(x=-20,y=0),restitution=e,duration=1)
            c=impact(p);assert c['time']==pytest.approx((40-math.sqrt(.2**2-.1**2))/40,abs=2e-14)
            assert c['normal']==pytest.approx(dict(x=math.sqrt(3)/2,y=-.5),abs=2e-12)
            r=E.evaluate_query(p,{'time':1});o=r['observables'];assert o['momentum_error']<1e-10
            assert o['kinetic_energy']<=o['initial_energy']+1e-10
            assert o['energy_loss']==pytest.approx(.5*ma*mb/(ma+mb)*(1-e*e)*c['normal_before']**2,abs=1e-10)
            assert abs(c['normal_after']+e*c['normal_before'])<1e-10
