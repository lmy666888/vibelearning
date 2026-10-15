import copy,math
import pytest
from app.experiments.registry import experiment
from app.experiments.kepler import G,AU,period,orbit,eccentric_anomaly
E=experiment('kepler-orbital-mechanics')
def params():return copy.deepcopy(E.manifest['presets'][0]['parameters'])
@pytest.mark.parametrize('ecc',[0,1e-12,.2,.85,.9])
def test_known_anomaly_reference_geometry_and_invariants(ecc):
    p=params();p['eccentricity']=ecc;a=p['semimajorAxis'];mu=G*(p['centralMass']+p['orbitingMass']);n=math.sqrt(mu/a**3)
    for anomaly in [0,.01,math.pi/2,math.pi,5.5]:
        t=(anomaly-ecc*math.sin(anomaly))/n;r=E.evaluate_query(p,{'time':t});s=r['state'];o=r['observables'];expected={'x':a*(math.cos(anomaly)-ecc),'y':a*math.sqrt(1-ecc*ecc)*math.sin(anomaly)}
        assert s['position']==pytest.approx(expected,rel=2e-10,abs=.1)
        assert o['radius']==pytest.approx(a*(1-ecc*math.cos(anomaly)),rel=1e-11)
        assert o['specific_energy']==pytest.approx(-mu/(2*a),rel=1e-10)
        assert o['specific_angular_momentum']==pytest.approx(math.sqrt(mu*a*(1-ecc*ecc)),rel=1e-10)
        assert abs(o['kepler_residual'])<1e-12
        # Independent focus property, not ellipse-center coordinates.
        x,y=s['position'].values();assert math.hypot(x,y)+math.hypot(x+2*a*ecc,y)==pytest.approx(2*a,rel=1e-11)

def test_period_circular_limit_apsides_and_third_law():
    p=params();T=period(p);r=E.evaluate_query(p,{'time':T/4});assert r['observables']['radius']==pytest.approx(p['semimajorAxis']);assert r['state']['position']['y']==pytest.approx(p['semimajorAxis'],rel=1e-12)
    q=dict(p,semimajorAxis=2*p['semimajorAxis']);assert period(q)/T==pytest.approx(math.sqrt(8),rel=1e-12)
    p['eccentricity']=.75;peri=E.evaluate_query(p,{'time':0})['observables'];apo=E.evaluate_query(p,{'time':T/2})['observables'];assert peri['radius']==pytest.approx(.25*p['semimajorAxis']);assert apo['radius']==pytest.approx(1.75*p['semimajorAxis']);assert peri['speed']/apo['speed']==pytest.approx(7,rel=1e-12)

def test_equal_area_independent_polygon_quadrature():
    p=params();p['eccentricity']=.6;T=period(p);areas=[]
    for start in [0,T/3]:
        positions=[orbit(p,start+T/12*i/1000)['state']['position'] for i in range(1001)];area=sum(a['x']*b['y']-a['y']*b['x'] for a,b in zip(positions,positions[1:]))/2;areas.append(area)
    expected=E.evaluate_query(p,{'time':0})['observables']['equal_time_area'];assert areas[0]==pytest.approx(areas[1],rel=3e-6);assert areas[0]==pytest.approx(expected,rel=3e-6)

@pytest.mark.parametrize('index',range(6))
def test_presets_periodic_and_deterministic(index):
    p=E.manifest['presets'][index]['parameters'];T=period(p);a=E.evaluate_query(p,{'time':.3*T});assert a==E.evaluate_query(p,{'time':.3*T});b=E.evaluate_query(p,{'time':1.3*T});assert a['state']['position']==pytest.approx(b['state']['position'],rel=1e-10,abs=.01)
@pytest.mark.parametrize('patch',[{'centralMass':0},{'semimajorAxis':0},{'eccentricity':1},{'eccentricity':-.1},{'showAreas':.5},{'initialMeanAnomaly':math.inf},{'durationPeriods':10}])
def test_invalid_orbits(patch):
    with pytest.raises(ValueError):E.validate_parameters(dict(params(),**patch))

def test_shared_confirmed_orbital_actions_and_context():
    from app.experiments.ai import apply,action_adapter
    from app.experiments.context import context,verify
    p=params();q=apply(E,p,[action_adapter.validate_python({'schema_version':1,'action':'set_parameter','target':'eccentricity','value':.6})]);assert q['eccentricity']==.6
    q=apply(E,q,[action_adapter.validate_python({'schema_version':1,'action':'set_parameter','target':'showAreas','value':1})]);assert q['showAreas']==1
    c=context(E.id,q,{'time':.4*period(q)});assert verify(c)==c
    with pytest.raises(ValueError):E.evaluate_query(p,{'time':period(p)*3})
