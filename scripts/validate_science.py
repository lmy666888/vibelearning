"""Reproducible independent references, fixed RNG, explicit error bounds; no provider calls."""
import sys,json,math,random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'backend'))
from app.experiments.registry import REGISTRY,experiment
from app.experiments.spatial import sample_field

def validate():
    rng=random.Random(20261015);results={}
    def record(id,metric,value,tolerance):
        row=results.setdefault(id,{}).setdefault(metric,dict(max_error=0.,tolerance=tolerance,samples=0));row['max_error']=max(row['max_error'],abs(value));row['samples']+=1
        if abs(value)>tolerance:raise AssertionError(f'{id}: {metric} outside declared tolerance')
    # Electric acceleration and exact trajectory, charge signs including zero.
    e=experiment('uniform-electric-field')
    for i in range(40):
        p=dict(e.manifest['presets'][0]['parameters']);p['charge']=rng.uniform(-4e-9,4e-9);p['field']=dict(x=0,y=rng.uniform(-200,200));t=rng.uniform(0,5);o=e.evaluate_query(p,dict(time=t));ay=p['charge']*p['field']['y']/p['mass'];expected=p['initialPosition']['y']+p['initialVelocity']['y']*t+.5*ay*t*t
        record(e.id,'position_m',o['state']['position']['y']-expected,1e-11)
    e=experiment('lorentz-force-2d');base=dict(e.manifest['presets'][2]['parameters'])
    for h in [.02,.01,.005]:
        p=dict(base,timeStep=h);w=p['charge']*p['magneticFieldZ']/p['mass'];t=4.;s=e.evaluate_query(p,dict(time=t))['state'];vx=p['initialVelocity']['x'];vy=p['initialVelocity']['y'];exact_angle=-w*t;actual=math.atan2(s['velocity']['y'],s['velocity']['x'])-math.atan2(vy,vx);error=math.atan2(math.sin(actual-exact_angle),math.cos(actual-exact_angle));bound=abs(w)**3*t*h*h/12+1e-11
        record(e.id,'phase_relative_to_bound',abs(error)/bound,1.)
        record(e.id,'speed_m_per_s',math.hypot(*s['velocity'].values())-math.hypot(vx,vy),1e-10)
    # Half-open boundary faces/corners and exact zero-charge grazing paths.
    e=experiment('multi-zone-em');p=json.loads(json.dumps(e.manifest['presets'][0]['parameters']));r=p['regions'][0];r['geometry']=dict(type='rectangle',x=0,y=0,width=1,height=1);r['electric_field']=dict(x=10,y=0);r['magnetic_field']=dict(z=0);r['enabled']=True;p['regions']=[r];p['charge']=0;p['duration']=1
    for x,y,inside in [(0,0,1),(1,0,0),(0,1,0),(1,1,0),(.5,0,1),(.5,1,0),(-1e-12,.5,0),(1-1e-12,.5,1)]:
        f=sample_field(dict(x=x,y=y),p['regions']);record(e.id,'boundary_membership',len(f['active'])-inside,0.)
    for y in [0,1,1-1e-10,1+1e-10]:
        q=dict(p,initialPosition=dict(x=-.5,y=y),initialVelocity=dict(x=2,y=0));s=e.evaluate_query(q,dict(time=1))['state'];record(e.id,'grazing_linear_position_m',s['position']['x']-1.5,1e-10)
    # Charged diagonal corner crossing: exact constant-acceleration flight inside one square.
    q=dict(p,charge=2e-9,initialPosition=dict(x=-.5,y=-.5),initialVelocity=dict(x=2,y=2));q['regions']=json.loads(json.dumps(p['regions']));q['regions'][0]['electric_field']=dict(x=10,y=10)
    acc=q['charge']/q['mass']*10;inside=2/(2+math.sqrt(4+2*acc));exit_v=2+acc*inside;expected=1+exit_v*(1-.25-inside)
    errors=[]
    for h in [.02,.01,.005]:
        trial=dict(q,timeStep=h);s=e.evaluate_query(trial,dict(time=1))['state'];err=abs(s['position']['x']-expected);errors.append(err);record(e.id,'charged_corner_error_over_bound',err/(4*acc*h*h),1.);record(e.id,'diagonal_symmetry_m',s['position']['x']-s['position']['y'],1e-12)
    if errors[-1]>errors[0]+1e-12:raise AssertionError('Corner refinement did not converge')
    e=experiment('double-slit-interference');from app.experiments.optics import intensity,profile
    for _ in range(40):
        p=dict(e.manifest['presets'][0]['parameters']);p['wavelength']=rng.uniform(400,700)*1e-9;p['slitSeparation']=rng.uniform(50,150)*1e-6;e.validate_parameters(p);y=rng.uniform(0,.02);record(e.id,'symmetry',intensity(p,y)-intensity(p,-y),1e-12);record(e.id,'normalization',sum(profile(p)[2])-1,1e-12)
    e=experiment('kepler-orbital-mechanics');from app.experiments.kepler import G,period
    for _ in range(80):
        p=dict(e.manifest['presets'][0]['parameters']);p['eccentricity']=rng.choice([0,1e-12,.9,rng.uniform(0,.9)]);a=p['semimajorAxis'];mu=G*(p['centralMass']+p['orbitingMass']);E=rng.uniform(0,math.tau);t=(E-p['eccentricity']*math.sin(E))/math.sqrt(mu/a**3);r=e.evaluate_query(p,dict(time=t));o=r['observables'];s=r['state'];record(e.id,'kepler_residual_rad',o['kepler_residual'],1e-12);record(e.id,'independent_x_relative',s['position']['x']/a-(math.cos(E)-p['eccentricity']),2e-11);record(e.id,'energy_relative',o['energy_relative_error'],1e-11);record(e.id,'angular_momentum_relative',o['angular_momentum_relative_error'],1e-11)
    e=experiment('momentum-collisions')
    for _ in range(80):
        p=json.loads(json.dumps(e.manifest['presets'][0]['parameters']));ma=rng.uniform(.1,10);mb=rng.uniform(.1,10);ua=rng.uniform(1,20);ub=-rng.uniform(1,20);eps=rng.uniform(0,1);p.update(massA=ma,massB=mb,velocityA=dict(x=ua,y=0),velocityB=dict(x=ub,y=0),restitution=eps,duration=10);r=e.evaluate_query(p,dict(time=10));o=r['observables'];V=(ma*ua+mb*ub)/(ma+mb);record(e.id,'post_velocity_m_per_s',o['post_velocityA']['x']-(V-eps*mb/(ma+mb)*(ua-ub)),1e-11);record(e.id,'momentum_kg_m_per_s',o['momentum']['x']-(ma*ua+mb*ub),1e-10);record(e.id,'loss_J',o['energy_loss']-.5*ma*mb/(ma+mb)*(1-eps*eps)*(ua-ub)**2,1e-9)
    return {'schema_version':1,'seed':20261015,'status':'passed','experiments':results,'limitations':'fixed-domain deterministic property samples and independent references, not proof of every real-world regime'}
if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--output');a=p.parse_args();s=json.dumps(validate(),indent=2)
    if a.output:Path(a.output).write_text(s+'\n')
    else:print(s)
