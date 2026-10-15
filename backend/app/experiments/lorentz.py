import math
from app.schemas.ai import Parameters, Number
from app.experiments.registry import bounds, time_query
class LorentzParameters(Parameters):
    magneticFieldZ: Number
    timeStep: Number
    duration: Number

def boris(p,s,h):
    a=p['charge']/p['mass'];ex=a*p['field']['x']*h/2;ey=a*p['field']['y']*h/2;t=a*p['magneticFieldZ']*h/2;k=2*t/(1+t*t)
    x=s['velocity']['x']+ex;y=s['velocity']['y']+ey;rx=x+y*t;ry=y-x*t
    vx=x+ry*k+ex;vy=y-rx*k+ey
    return dict(time=s['time']+h,position=dict(x=s['position']['x']+h*(s['velocity']['x']+vx)/2,y=s['position']['y']+h*(s['velocity']['y']+vy)/2),velocity=dict(x=vx,y=vy))

def observables(p,s):
    q=p['charge'];m=p['mass'];b=p['magneticFieldZ'];v=s['velocity'];ef=dict(x=q*p['field']['x'],y=q*p['field']['y']);mf=dict(x=q*v['y']*b,y=-q*v['x']*b)
    f=dict(x=ef['x']+mf['x'],y=ef['y']+mf['y']);a=dict(x=f['x']/m,y=f['y']/m);speed=math.hypot(v['x'],v['y']);omega=q*b/m
    result=dict(electric_force=ef,magnetic_force=mf,force=f,acceleration=a,acceleration_magnitude=math.hypot(a['x'],a['y']),speed=speed,kinetic_energy=.5*m*speed*speed,theoretical_radius=None if omega==0 else math.hypot(v['x']-p['field']['y']/b,v['y']+p['field']['x']/b)/abs(omega),cyclotron_frequency=omega,drift_velocity=None if omega==0 else dict(x=p['field']['y']/b,y=-p['field']['x']/b))
    def finite(v):
        if isinstance(v,dict):
            for x in v.values():finite(x)
        elif type(v) in (float,int) and not math.isfinite(v):raise ValueError('Numerical range exceeded')
    finite(s);finite(result);return result

class LorentzPlugin:
    def __init__(self,manifest):self.manifest=manifest;self.id=manifest['id'];self.version=manifest['version']
    def validate_parameters(self,data):
        p=LorentzParameters.model_validate(data).model_dump();bounds(p,self.manifest)
        if abs(p['charge']/p['mass']*p['magneticFieldZ'])*p['timeStep']>.020000000001 or math.ceil(p['duration']/p['timeStep'])>100000:raise ValueError('Unsupported gyro-angle or step budget')
        return p
    def create_initial_state(self,parameters):return self.evaluate_query(parameters,self.manifest['initial_query'])['state']
    def evaluate_query(self,parameters,query):return self.evaluate(parameters,time_query(query))
    def evaluate(self,parameters,time):
        p=self.validate_parameters(parameters)
        if type(time) not in (float,int) or not math.isfinite(time) or not 0<=time<=p['duration']:raise ValueError('Unsupported duration')
        s=dict(time=0,position=p['initialPosition'].copy(),velocity=p['initialVelocity'].copy())
        n=math.floor(time/p['timeStep'])
        for _ in range(n):s=boris(p,s,p['timeStep'])
        rest=time-n*p['timeStep']
        if rest>1e-12:s=boris(p,s,rest)
        s['time']=time;o=observables(p,s)
        if p['field']['x']==p['field']['y']==0:
            v0=math.hypot(p['initialVelocity']['x'],p['initialVelocity']['y'])
            if abs(o['speed']-v0)>max(1e-11,v0*5e-10):raise ValueError('Magnetic energy error exceeded tolerance')
        return dict(state=s,observables=o)
