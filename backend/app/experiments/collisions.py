"""Isolated two-body events: exact 1D velocities and frictionless 2D normal impulse."""
import math
from app.schemas.ai import StrictModel, Number, Vector2
from app.experiments.registry import bounds, time_query

class CollisionParameters(StrictModel):
    massA: Number
    massB: Number
    radiusA: Number
    radiusB: Number
    positionA: Vector2
    positionB: Vector2
    velocityA: Vector2
    velocityB: Vector2
    dimensions: Number
    restitution: Number
    frame: Number
    duration: Number

def add(a,b,k=1):return {s:a[s]+k*b[s] for s in ('x','y')}
def scale(a,k):return {s:a[s]*k for s in ('x','y')}
def dot(a,b):return a['x']*b['x']+a['y']*b['y']
def energy(p,va,vb):return .5*(p['massA']*dot(va,va)+p['massB']*dot(vb,vb))
def momentum(p,va,vb):return add(scale(va,p['massA']),scale(vb,p['massB']))

def impact(p):
    r=add(p['positionB'],p['positionA'],-1);u=add(p['velocityB'],p['velocityA'],-1)
    R=p['radiusA']+p['radiusB'];speed2=dot(u,u);ru=dot(r,u)
    if speed2==0 or ru>=0:return None
    # Discriminant/4 = |u|²R² - (r cross u)², avoiding cancellation at large separation.
    disc=speed2*R*R-(r['x']*u['y']-r['y']*u['x'])**2
    if disc<=0:return None  # a grazing touch has zero normal impulse
    C=dot(r,r)-R*R
    t=(abs(r['x'])-R)/abs(u['x']) if p['dimensions']==1 else C/(-ru+math.sqrt(disc))
    if t<0 or t>p['duration']:return None
    ca=add(p['positionA'],p['velocityA'],t);cb=add(p['positionB'],p['velocityB'],t)
    d=add(cb,ca,-1);normal=scale(d,1/math.hypot(d['x'],d['y']));vn=dot(u,normal)
    if vn>=0:return None
    ma=p['massA'];mb=p['massB'];e=p['restitution'];J=-(1+e)*vn/(1/ma+1/mb)
    if p['dimensions']==1:
        # Exact momentum + restitution solution, valid for either contact orientation.
        va=dict(x=((ma-e*mb)*p['velocityA']['x']+(1+e)*mb*p['velocityB']['x'])/(ma+mb),y=0.)
        vb=dict(x=((mb-e*ma)*p['velocityB']['x']+(1+e)*ma*p['velocityA']['x'])/(ma+mb),y=0.)
    else:
        va=add(p['velocityA'],normal,-J/ma);vb=add(p['velocityB'],normal,J/mb)
    return dict(time=t,normal=normal,point=add(ca,normal,p['radiusA']),contactA=ca,contactB=cb,impulse=J,postA=va,postB=vb,normal_before=vn,normal_after=dot(add(vb,va,-1),normal))

def collision(p,t):
    event=impact(p);hit=event is not None and t>=event['time'];va=event['postA'] if hit else p['velocityA'];vb=event['postB'] if hit else p['velocityB']
    pa=add(event['contactA'],va,t-event['time']) if hit else add(p['positionA'],va,t)
    pb=add(event['contactB'],vb,t-event['time']) if hit else add(p['positionB'],vb,t)
    total=p['massA']+p['massB'];initialP=momentum(p,p['velocityA'],p['velocityB']);vcom=scale(initialP,1/total);com0=scale(add(scale(p['positionA'],p['massA']),scale(p['positionB'],p['massB'])),1/total)
    offset=add(com0,vcom,t) if p['frame']==1 else dict(x=0.,y=0.);boost=vcom if p['frame']==1 else dict(x=0.,y=0.)
    before=energy(p,p['velocityA'],p['velocityB']);after=energy(p,event['postA'],event['postB']) if event else before;K=energy(p,va,vb);P=momentum(p,va,vb)
    return dict(state=dict(time=t,positionA=pa,positionB=pb,velocityA=va,velocityB=vb,displayA=add(pa,offset,-1),displayB=add(pb,offset,-1),displayVelocityA=add(va,boost,-1),displayVelocityB=add(vb,boost,-1),collided=hit,collision_count=int(hit),event=event),observables=dict(momentum=P,kinetic_energy=K,initial_energy=before,post_energy=after,energy_loss=before-K,predicted_energy_loss=before-after,momentum_error=math.hypot(P['x']-initialP['x'],P['y']-initialP['y']),center_of_mass_velocity=vcom,display_momentum=momentum(p,add(va,boost,-1),add(vb,boost,-1)),display_kinetic_energy=energy(p,add(va,boost,-1),add(vb,boost,-1)),collision_time=event['time'] if event else None,impulse=event['impulse'] if event else 0.,normal_before=event['normal_before'] if event else None,normal_after=event['normal_after'] if event else None,pre_velocityA=p['velocityA'],pre_velocityB=p['velocityB'],post_velocityA=event['postA'] if event else p['velocityA'],post_velocityB=event['postB'] if event else p['velocityB']))

class CollisionPlugin:
    def __init__(self,manifest):self.manifest=manifest;self.id=manifest['id'];self.version=manifest['version']
    def validate_parameters(self,data):
        p=CollisionParameters.model_validate(data).model_dump();bounds(p,self.manifest)
        for k in ['dimensions','frame']:
            if not p[k].is_integer():raise ValueError('Expected integral dimension/frame choice')
            p[k]=int(p[k])
        if p['dimensions']==1 and any(p[k]['y']!=0 for k in ['positionA','positionB','velocityA','velocityB']):raise ValueError('1D requires all transverse positions and velocities zero')
        r=add(p['positionB'],p['positionA'],-1)
        if math.hypot(r['x'],r['y'])<p['radiusA']+p['radiusB']:raise ValueError('Initial bodies must not overlap')
        return p
    def create_initial_state(self,p):return self.evaluate_query(p,{'time':0})['state']
    def evaluate_query(self,parameters,query):
        p=self.validate_parameters(parameters);t=time_query(query)
        if type(t) not in (int,float) or not math.isfinite(t) or not 0<=t<=p['duration']:raise ValueError('Unsupported collision duration')
        return collision(p,t)
