"""Exact planar elliptical two-body relative solution, no EM force integrator."""
import math
from app.schemas.ai import StrictModel,Number
from app.experiments.registry import bounds,time_query
G=6.67430e-11;AU=149597870700.;YEAR=31557600.
class OrbitalParameters(StrictModel):
    centralMass:Number;orbitingMass:Number;semimajorAxis:Number;eccentricity:Number;initialMeanAnomaly:Number;durationPeriods:Number;showAreas:Number

def eccentric_anomaly(mean,e):
    M=mean%math.tau
    if M==0 or M==math.pi:return M
    lo=0.;hi=math.tau;E=M if e<.8 else math.pi
    for _ in range(64):
        f=E-e*math.sin(E)-M
        if abs(f)<=1e-13:return E
        if f>0:hi=E
        else:lo=E
        trial=E-f/(1-e*math.cos(E))
        E=trial if lo<trial<hi else (lo+hi)/2
    if abs(E-e*math.sin(E)-M)>1e-12:raise ValueError('Kepler root did not converge')
    return E

def period(p):return math.tau*math.sqrt(p['semimajorAxis']**3/(G*(p['centralMass']+p['orbitingMass'])))
def orbit(p,t):
    a=p['semimajorAxis'];e=p['eccentricity'];mu=G*(p['centralMass']+p['orbitingMass']);n=math.sqrt(mu/a**3);mean=(p['initialMeanAnomaly']+n*t)%math.tau;E=eccentric_anomaly(mean,e);cos=math.cos(E);sin=math.sin(E);b=a*math.sqrt(1-e*e);den=1-e*cos;r=a*den;edot=n/den
    pos=dict(x=a*(cos-e),y=b*sin);v=dict(x=-a*sin*edot,y=b*cos*edot);acc={k:-mu*pos[k]/r**3 for k in ['x','y']};force={k:-G*p['centralMass']*p['orbitingMass']*pos[k]/r**3 for k in ['x','y']}
    h=pos['x']*v['y']-pos['y']*v['x'];energy=.5*(v['x']**2+v['y']**2)-mu/r;href=math.sqrt(mu*a*(1-e*e));eref=-mu/(2*a)
    state=dict(time=t,position=pos,velocity=v,relative_acceleration=acc,force=force,mean_anomaly=mean,eccentric_anomaly=E)
    return dict(state=state,observables=dict(period=period(p),radius=r,speed=math.hypot(*v.values()),periapsis=a*(1-e),apoapsis=a*(1+e),specific_angular_momentum=h,specific_energy=energy,orbital_energy=energy*p['centralMass']*p['orbitingMass']/(p['centralMass']+p['orbitingMass']),swept_area=.5*href*t,equal_time_area=.5*href*period(p)/12,kepler_residual=E-e*math.sin(E)-mean,energy_relative_error=abs((energy-eref)/eref),angular_momentum_relative_error=abs((h-href)/href)))
class KeplerPlugin:
    def __init__(self,manifest):self.manifest=manifest;self.id=manifest['id'];self.version=manifest['version']
    def validate_parameters(self,data):
        p=OrbitalParameters.model_validate(data).model_dump();bounds(p,self.manifest)
        for k in ['durationPeriods','showAreas']:
            if not p[k].is_integer():raise ValueError('Expected integral orbit count/sector flag')
            p[k]=int(p[k])
        return p
    def create_initial_state(self,p):return self.evaluate_query(p,{'time':0})['state']
    def evaluate_query(self,parameters,query):
        p=self.validate_parameters(parameters);t=time_query(query)
        if type(t) not in (int,float) or not math.isfinite(t) or not 0<=t<=period(p)*p['durationPeriods']:raise ValueError('Unsupported orbital duration')
        return orbit(p,t)
