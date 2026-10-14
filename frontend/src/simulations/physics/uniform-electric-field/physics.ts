import type { Vector2, ParticleState } from '../../core/types';
import type { SimulationParameters } from './types';
export function finite(value:number):number { if(!Number.isFinite(value)) throw new RangeError('数值必须有限'); return value; }
export function validateParameters(p:SimulationParameters):void {
 [p.charge,p.mass,p.field.x,p.field.y,p.initialPosition.x,p.initialPosition.y,p.initialVelocity.x,p.initialVelocity.y].forEach(finite);
 if(p.mass<=0) throw new RangeError('质量必须大于零');
}
export function calculateForce(charge:number,field:Vector2):Vector2 {
 [charge,field.x,field.y].forEach(finite); return {x:finite(charge*field.x),y:finite(charge*field.y)};
}
export function calculateAcceleration(force:Vector2,mass:number):Vector2 {
 [force.x,force.y,mass].forEach(finite); if(mass<=0) throw new RangeError('质量必须大于零');
 return {x:finite(force.x/mass),y:finite(force.y/mass)};
}
export function calculateParticleState(p:SimulationParameters,time:number):ParticleState {
 validateParameters(p); finite(time); if(time<0) throw new RangeError('时间不能为负');
 const force=calculateForce(p.charge,p.field),acceleration=calculateAcceleration(force,p.mass);
 return {time,force,acceleration,position:{x:finite(p.initialPosition.x+p.initialVelocity.x*time+0.5*acceleration.x*time*time),y:finite(p.initialPosition.y+p.initialVelocity.y*time+0.5*acceleration.y*time*time)},velocity:{x:finite(p.initialVelocity.x+acceleration.x*time),y:finite(p.initialVelocity.y+acceleration.y*time)}};
}
export function calculateTrajectory(p:SimulationParameters,time:number,samples=240):Vector2[] {
 calculateParticleState(p,time); if(!Number.isInteger(samples)||samples<2||samples>10000) throw new RangeError('采样数需为 2–10000');
 if(time===0) return []; return Array.from({length:samples},(_,i)=>calculateParticleState(p,time*i/(samples-1)).position);
}
export function calculateVectorMagnitude(vector:Vector2):number {
 [vector.x,vector.y].forEach(finite); return finite(Math.hypot(vector.x,vector.y));
}
export function calculateFieldMagnitude(field:Vector2):number { return calculateVectorMagnitude(field); }
export function chargePolarity(q:number):string { finite(q); return q>0?'正电荷':q<0?'负电荷':'中性'; }
