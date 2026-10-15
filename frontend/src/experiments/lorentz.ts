import type {Data,Manifest,RegisteredEngine} from './contract';
import {bounded,freeze} from './validation';
import {particleParameters,timeQuery} from './electric';
export interface LorentzParameters {charge:number;mass:number;field:{x:number;y:number};magneticFieldZ:number;initialPosition:{x:number;y:number};initialVelocity:{x:number;y:number};timeStep:number;duration:number}
export interface LorentzState {time:number;position:{x:number;y:number};velocity:{x:number;y:number}}
/** Synchronized Boris/Cayley rotation, symmetric E kicks, trapezoidal position. */
export function boris(p:LorentzParameters,s:LorentzState,h:number):LorentzState{
 const a=p.charge/p.mass,ex=a*p.field.x*h/2,ey=a*p.field.y*h/2,t=a*p.magneticFieldZ*h/2,k=2*t/(1+t*t);
 const x=s.velocity.x+ex,y=s.velocity.y+ey,rx=x+y*t,ry=y-x*t;
 const vx=x+ry*k+ex,vy=y-rx*k+ey;
 return {time:s.time+h,position:{x:s.position.x+h*(s.velocity.x+vx)/2,y:s.position.y+h*(s.velocity.y+vy)/2},velocity:{x:vx,y:vy}};
}
export function lorentzObservables(p:LorentzParameters,s:LorentzState):Data{
 const ef={x:p.charge*p.field.x,y:p.charge*p.field.y},mf={x:p.charge*s.velocity.y*p.magneticFieldZ,y:-p.charge*s.velocity.x*p.magneticFieldZ},force={x:ef.x+mf.x,y:ef.y+mf.y},acceleration={x:force.x/p.mass,y:force.y/p.mass},speed=Math.hypot(s.velocity.x,s.velocity.y),omega=p.charge*p.magneticFieldZ/p.mass;
 const o={electric_force:ef,magnetic_force:mf,force,acceleration,acceleration_magnitude:Math.hypot(acceleration.x,acceleration.y),speed,kinetic_energy:.5*p.mass*speed*speed,theoretical_radius:omega===0?null:Math.hypot(s.velocity.x-p.field.y/p.magneticFieldZ,s.velocity.y+p.field.x/p.magneticFieldZ)/Math.abs(omega),cyclotron_frequency:omega,drift_velocity:omega===0?null:{x:p.field.y/p.magneticFieldZ,y:-p.field.x/p.magneticFieldZ}};
 const finite=(v:unknown):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Numerical range exceeded.');if(v&&typeof v==='object')Object.values(v).forEach(finite);};finite(s);finite(o);return o;
}
export function lorentzPlugin(manifest:Manifest):RegisteredEngine{
 const validate=(input:unknown)=>{const p=particleParameters(input,['charge','mass','field','initialPosition','initialVelocity','magneticFieldZ','timeStep','duration']);bounded(p,manifest);const typed=p as unknown as LorentzParameters;
 if(Math.abs(typed.charge/typed.mass*typed.magneticFieldZ)*typed.timeStep>.020000000001||Math.ceil(typed.duration/typed.timeStep)>100000)throw new Error('Unsupported gyro-angle or step budget; reduce timestep/duration.');return freeze(p);};
 return {id:manifest.id,version:manifest.version,manifest,validateParameters:validate,
 createInitialState:p=>{const v=validate(p) as unknown as LorentzParameters;return {time:0,position:{...v.initialPosition},velocity:{...v.initialVelocity}};},
 evaluate:(parameters,query)=>{const time=timeQuery(query);const p=validate(parameters) as unknown as LorentzParameters;if(!Number.isFinite(time)||time<0||time>p.duration)throw new Error('Unsupported duration.');let s:LorentzState={time:0,position:{...p.initialPosition},velocity:{...p.initialVelocity}};
 const n=Math.floor(time/p.timeStep);for(let i=0;i<n;i++)s=boris(p,s,p.timeStep);const rest=time-n*p.timeStep;if(rest>1e-12)s=boris(p,s,rest);s.time=time;
 const observables=lorentzObservables(p,s);if(p.field.x===0&&p.field.y===0){const v0=Math.hypot(p.initialVelocity.x,p.initialVelocity.y);if(Math.abs((observables.speed as number)-v0)>Math.max(1e-11,v0*5e-10))throw new Error('Magnetic energy error exceeded tolerance.');}
 return {state:s as unknown as Data,observables};}};
}
