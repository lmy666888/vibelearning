"""Prescribed rectangular fields; bounded geometry-aware midpoint Boris substeps."""
import math
from typing import Annotated,Literal
from pydantic import Field,StringConstraints,field_validator
from app.schemas.ai import StrictModel,Number,Vector2
from app.experiments.lorentz import boris,observables
from app.experiments.registry import bounds,time_query
ID=Annotated[str,StringConstraints(pattern=r'^[a-z][a-z0-9-]{0,31}$')]
class Rectangle(StrictModel):
    type:Literal['rectangle']
    x:Number;y:Number;width:Number;height:Number
class Magnetic(StrictModel):z:Number
class Region(StrictModel):
    schema_version:Literal[1]
    id:ID
    name:Annotated[str,StringConstraints(min_length=1,max_length=48)]
    geometry:Rectangle
    electric_field:Vector2
    magnetic_field:Magnetic
    enabled:bool
    color:Literal['cyan','violet','amber','green']
    @field_validator('schema_version',mode='before')
    @classmethod
    def strict_version(cls,v):
        if type(v) is not int or v!=1:raise ValueError('Expected region version 1')
        return v
class SpatialParameters(StrictModel):
    charge:Number;mass:Number
    initialPosition:Vector2;initialVelocity:Vector2
    timeStep:Number;duration:Number
    regions:Annotated[list[Region],Field(max_length=12)]

def validate_regions(regions):
    ids=set()
    for r in regions:
        if type(r['schema_version']) is not int:raise ValueError('Invalid region version')
        if r['id'] in ids:raise ValueError('Duplicate region ID')
        ids.add(r['id']);g=r['geometry']
        if not (.1<=g['width']<=200 and .1<=g['height']<=200 and -100<=g['x']<=100-g['width'] and -100<=g['y']<=100-g['height']):raise ValueError('Invalid region geometry')
        if max(abs(r['electric_field']['x']),abs(r['electric_field']['y']),abs(r['magnetic_field']['z']))>500:raise ValueError('Unsupported regional field')

def sample_field(position,regions):
    ex=ey=b=0.;active=[]
    for r in sorted(regions,key=lambda r:r['id']):
        g=r['geometry']
        if r['enabled'] and g['x']<=position['x']<g['x']+g['width'] and g['y']<=position['y']<g['y']+g['height']:
            ex+=r['electric_field']['x'];ey+=r['electric_field']['y'];b+=r['magnetic_field']['z'];active.append(r['id'])
    return dict(x=ex,y=ey,z=b,active=active)

def step_size(p):
    enabled=[r for r in p['regions'] if r['enabled']]
    a=abs(p['charge']/p['mass']);emax=sum(math.hypot(r['electric_field']['x'],r['electric_field']['y']) for r in enabled)
    vmax=math.hypot(*p['initialVelocity'].values())+a*emax*p['duration']
    gaps=[]
    for axis,size in [('x','width'),('y','height')]:
        edges=sorted(set(v for r in enabled for v in [r['geometry'][axis],r['geometry'][axis]+r['geometry'][size]]))
        gaps.extend(y-x for x,y in zip(edges,edges[1:]) if y>x)
    spatial=min(gaps)/(8*vmax) if gaps and vmax else p['timeStep']
    omega=a*sum(abs(r['magnetic_field']['z']) for r in enabled)
    h=min(p['timeStep'],spatial,.02/omega if omega else p['timeStep'])
    if h<=0 or math.ceil(p['duration']/h)>100000:raise ValueError('Spatial resolution exceeds 100000 substep budget; widen gaps, reduce fields/speed/duration')
    return h

def _advance(p,s,h):
    # Midpoint local sampling; conservative displacement cap resolves every edge slab.
    f=sample_field(dict(x=s['position']['x']+s['velocity']['x']*h/2,y=s['position']['y']+s['velocity']['y']*h/2),p['regions'])
    q=dict(p,field=dict(x=f['x'],y=f['y']),magneticFieldZ=f['z'])
    result=boris(q,s,h)
    if not all(math.isfinite(v) and abs(v)<1e9 for v in [*result['position'].values(),*result['velocity'].values()]):raise ValueError('Numerical range exceeded')
    return result

def advance(p,s,h):
    # Split the ballistic chord at ALL enabled edge planes. The conservative
    # substep cap resolves narrow slabs; cuts improve crossing-time quadrature.
    cuts={0.,1.}
    for r in p['regions']:
        if not r['enabled']:continue
        g=r['geometry']
        for axis,size in [('x','width'),('y','height')]:
            delta=s['velocity'][axis]*h
            if delta:
                for edge in [g[axis],g[axis]+g[size]]:
                    u=(edge-s['position'][axis])/delta
                    if 1e-12<u<1-1e-12:cuts.add(u)
    ordered=sorted(cuts)
    for a,b in zip(ordered,ordered[1:]):s=_advance(p,s,h*(b-a))
    return s

def spatial_observables(p,s):
    f=sample_field(s['position'],p['regions']);o=observables(dict(p,field=dict(x=f['x'],y=f['y']),magneticFieldZ=f['z']),s)
    for key in ['theoretical_radius','cyclotron_frequency','drift_velocity']:del o[key]
    v0=math.hypot(*p['initialVelocity'].values())
    if not any(r['enabled'] and (r['electric_field']['x'] or r['electric_field']['y']) for r in p['regions']) and abs(o['speed']-v0)>max(1e-11,v0*5e-10):raise ValueError('Magnetic energy error exceeded tolerance')
    o.update(displacement={k:s['position'][k]-p['initialPosition'][k] for k in ['x','y']},velocity_change={k:s['velocity'][k]-p['initialVelocity'][k] for k in ['x','y']},energy_change=o['kinetic_energy']-.5*p['mass']*v0*v0)
    return dict(o,local_electric_field=dict(x=f['x'],y=f['y']),local_magnetic_field=f['z'],active_regions=f['active'],boundary_step=step_size(p))

class SpatialPlugin:
    def __init__(self,manifest):self.manifest=manifest;self.id=manifest['id'];self.version=manifest['version']
    def validate_parameters(self,data):
        # Reject bool schema versions before Literal coercion.
        if isinstance(data,dict) and isinstance(data.get('regions'),list):
            for r in data['regions']:
                if isinstance(r,dict) and type(r.get('schema_version')) is not int:raise ValueError('Invalid region version')
        p=SpatialParameters.model_validate(data).model_dump();bounds(p,self.manifest);validate_regions(p['regions']);step_size(p);return p
    def create_initial_state(self,p):return self.evaluate_query(p,{'time':0})['state']
    def evaluate_query(self,parameters,query):
        p=self.validate_parameters(parameters);t=time_query(query)
        if type(t) not in (int,float) or not math.isfinite(t) or not 0<=t<=p['duration']:raise ValueError('Unsupported duration')
        s=dict(time=0,position=p['initialPosition'].copy(),velocity=p['initialVelocity'].copy());h=step_size(p);n=math.floor(t/h)
        for _ in range(n):s=advance(p,s,h)
        rest=t-n*h
        if rest>1e-12:s=advance(p,s,rest)
        s['time']=t
        return dict(state=s,observables=spatial_observables(p,s))
