import { calculateParticleState } from '../simulations/physics/uniform-electric-field/physics';
import type { SimulationParameters } from '../simulations/physics/uniform-electric-field/types';
import type { Data,Manifest,RegisteredEngine } from './contract';
import {bounded,record,exact,freeze} from './validation';
export function timeQuery(query:Data):number{exact(query,['time']);if(typeof query.time!=='number')throw new Error('Invalid time query.');return query.time;}
export function particleParameters(input:unknown,fields:string[]):Data{
 const p=structuredClone(record(input));exact(p,fields);for(const k of ['field','initialPosition','initialVelocity']){const v=record(p[k]);exact(v,['x','y']);for(const n of Object.values(v))if(typeof n!=='number'||!Number.isFinite(n))throw new Error('Invalid vector.');}return p;
}
export function electricPlugin(manifest:Manifest):RegisteredEngine{
 const validate=(input:unknown)=>{const p=particleParameters(input,['charge','mass','field','initialPosition','initialVelocity']);bounded(p,manifest);calculateParticleState(p as unknown as SimulationParameters,0);return freeze(p);};
 return {id:manifest.id,version:manifest.version,manifest,validateParameters:validate,
 createInitialState:p=>calculateParticleState(validate(p) as unknown as SimulationParameters,0) as unknown as Data,
 evaluate:(p,query)=>{const t=timeQuery(query);if(!Number.isFinite(t)||t<0||t>manifest.evolution.max_duration)throw new Error('Unsupported duration.');const s=calculateParticleState(validate(p) as unknown as SimulationParameters,t);return {state:s as unknown as Data,observables:{force:s.force,acceleration:s.acceleration,acceleration_magnitude:Math.hypot(s.acceleration.x,s.acceleration.y),speed:Math.hypot(s.velocity.x,s.velocity.y)}};}};
}
