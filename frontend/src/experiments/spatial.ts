import type {Data,Manifest,RegisteredEngine} from './contract';
import {record,exact,bounded,freeze} from './validation';
import {boris,lorentzObservables,type LorentzParameters,type LorentzState} from './lorentz';
import {timeQuery} from './electric';
export interface Region {schema_version:1;id:string;name:string;geometry:{type:'rectangle';x:number;y:number;width:number;height:number};electric_field:{x:number;y:number};magnetic_field:{z:number};enabled:boolean;color:'cyan'|'violet'|'amber'|'green'}
export interface SpatialParameters {charge:number;mass:number;initialPosition:{x:number;y:number};initialVelocity:{x:number;y:number};timeStep:number;duration:number;regions:Region[]}
function number(v:unknown){if(typeof v!=='number'||!Number.isFinite(v))throw new Error('Expected finite SI number.');return v;}
export function validateRegion(raw:unknown):Region{
 const r=record(raw);exact(r,['schema_version','id','name','geometry','electric_field','magnetic_field','enabled','color']);
 if(r.schema_version!==1||typeof r.id!=='string'||! /^[a-z][a-z0-9-]{0,31}$/.test(r.id)||typeof r.name!=='string'||r.name.length<1||r.name.length>48||typeof r.enabled!=='boolean'||!['cyan','violet','amber','green'].includes(String(r.color)))throw new Error('Invalid region metadata.');
 const g=record(r.geometry),e=record(r.electric_field),b=record(r.magnetic_field);exact(g,['type','x','y','width','height']);exact(e,['x','y']);exact(b,['z']);
 if(g.type!=='rectangle'||number(g.width)<.1||number(g.width)>200||number(g.height)<.1||number(g.height)>200||number(g.x)<-100||number(g.y)<-100||number(g.x)+Number(g.width)>100||number(g.y)+Number(g.height)>100)throw new Error('Invalid rectangle: .1–200 m, within ±100 m.');
 if([e.x,e.y,b.z].some(v=>Math.abs(number(v))>500))throw new Error('Field components must be within ±500 SI.');return structuredClone(r) as unknown as Region;
}
export function sampleField(position:{x:number;y:number},regions:Region[]){let x=0,y=0,z=0;const active:string[]=[];
 for(const r of [...regions].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){const g=r.geometry;if(r.enabled&&position.x>=g.x&&position.x<g.x+g.width&&position.y>=g.y&&position.y<g.y+g.height){x+=r.electric_field.x;y+=r.electric_field.y;z+=r.magnetic_field.z;active.push(r.id);}}
 return {x,y,z,active};
}
export function spatialStep(p:SpatialParameters){const enabled=p.regions.filter(r=>r.enabled),a=Math.abs(p.charge/p.mass),emax=enabled.reduce((n,r)=>n+Math.hypot(r.electric_field.x,r.electric_field.y),0),vmax=Math.hypot(p.initialVelocity.x,p.initialVelocity.y)+a*emax*p.duration,gaps:number[]=[];
 for(const [axis,size] of [['x','width'],['y','height']] as const){const edges=[...new Set(enabled.flatMap(r=>[r.geometry[axis],r.geometry[axis]+r.geometry[size]]))].sort((a,b)=>a-b);edges.slice(1).forEach((v,i)=>{if(v>edges[i])gaps.push(v-edges[i]);});}
 const omega=a*enabled.reduce((n,r)=>n+Math.abs(r.magnetic_field.z),0),h=Math.min(p.timeStep,gaps.length&&vmax?Math.min(...gaps)/(8*vmax):p.timeStep,omega?.02/omega:p.timeStep);
 if(h<=0||Math.ceil(p.duration/h)>100000)throw new Error('Spatial resolution exceeds 100000 substep budget; widen gaps or reduce fields/speed/duration.');return h;
}
function microAdvance(p:SpatialParameters,s:LorentzState,h:number):LorentzState{const f=sampleField({x:s.position.x+s.velocity.x*h/2,y:s.position.y+s.velocity.y*h/2},p.regions),next=boris({...p,field:{x:f.x,y:f.y},magneticFieldZ:f.z} as LorentzParameters,s,h);if([...Object.values(next.position),...Object.values(next.velocity)].some(v=>!Number.isFinite(v)||Math.abs(v)>=1e9))throw new Error('Numerical range exceeded.');return next;}
export function spatialAdvance(p:SpatialParameters,s:LorentzState,h:number):LorentzState{
 const cuts=new Set([0,1]);for(const r of p.regions){if(!r.enabled)continue;for(const [axis,size] of [['x','width'],['y','height']] as const){const delta=s.velocity[axis]*h;if(delta)for(const edge of [r.geometry[axis],r.geometry[axis]+r.geometry[size]]){const u=(edge-s.position[axis])/delta;if(u>1e-12&&u<1-1e-12)cuts.add(u);}}}
 const ordered=[...cuts].sort((a,b)=>a-b);for(let i=1;i<ordered.length;i++)s=microAdvance(p,s,h*(ordered[i]-ordered[i-1]));return s;
}
export function spatialObservables(p:SpatialParameters,s:LorentzState):Data{const f=sampleField(s.position,p.regions),o=lorentzObservables({...p,field:{x:f.x,y:f.y},magneticFieldZ:f.z} as LorentzParameters,s);for(const k of ['theoretical_radius','cyclotron_frequency','drift_velocity'])delete o[k];const v0=Math.hypot(p.initialVelocity.x,p.initialVelocity.y);if(!p.regions.some(r=>r.enabled&&(r.electric_field.x||r.electric_field.y))&&Math.abs(Number(o.speed)-v0)>Math.max(1e-11,v0*5e-10))throw new Error('Magnetic energy error exceeded tolerance.');return {...o,displacement:{x:s.position.x-p.initialPosition.x,y:s.position.y-p.initialPosition.y},velocity_change:{x:s.velocity.x-p.initialVelocity.x,y:s.velocity.y-p.initialVelocity.y},energy_change:Number(o.kinetic_energy)-.5*p.mass*v0*v0,local_electric_field:{x:f.x,y:f.y},local_magnetic_field:f.z,active_regions:f.active,boundary_step:spatialStep(p)};}
export function spatialPlugin(manifest:Manifest):RegisteredEngine{
 const validate=(raw:unknown)=>{const p=structuredClone(record(raw));exact(p,['charge','mass','initialPosition','initialVelocity','timeStep','duration','regions']);for(const k of ['initialPosition','initialVelocity']){const v=record(p[k]);exact(v,['x','y']);Object.values(v).forEach(number);}bounded(p,manifest);
 if(!Array.isArray(p.regions)||p.regions.length>12)throw new Error('At most 12 regions.');p.regions=p.regions.map(validateRegion);if(new Set((p.regions as Region[]).map(r=>r.id)).size!==(p.regions as Region[]).length)throw new Error('Duplicate region ID.');spatialStep(p as unknown as SpatialParameters);return freeze(p);};
 return {id:manifest.id,version:manifest.version,manifest,validateParameters:validate,createInitialState:p=>{const v=validate(p) as unknown as SpatialParameters;return {time:0,position:{...v.initialPosition},velocity:{...v.initialVelocity}};},evaluate:(raw,q)=>{const p=validate(raw) as unknown as SpatialParameters,t=timeQuery(q);if(!Number.isFinite(t)||t<0||t>p.duration)throw new Error('Unsupported duration.');let s:LorentzState={time:0,position:{...p.initialPosition},velocity:{...p.initialVelocity}};const h=spatialStep(p),n=Math.floor(t/h);for(let i=0;i<n;i++)s=spatialAdvance(p,s,h);if(t-n*h>1e-12)s=spatialAdvance(p,s,t-n*h);s.time=t;return {state:s as unknown as Data,observables:spatialObservables(p,s)};}};
}
