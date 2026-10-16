/** Exact isolated pair, continuous time-of-impact; no force integration or iteration loop. */
import type {Data,Manifest,RegisteredEngine} from './contract';
import {record,exact,bounded,freeze} from './validation';
import {timeQuery} from './electric';
export interface Vec{x:number;y:number}
export interface CollisionParameters {massA:number;massB:number;radiusA:number;radiusB:number;positionA:Vec;positionB:Vec;velocityA:Vec;velocityB:Vec;dimensions:number;restitution:number;frame:number;duration:number}
export const add=(a:Vec,b:Vec,k=1):Vec=>({x:a.x+k*b.x,y:a.y+k*b.y});
export const scale=(a:Vec,k:number):Vec=>({x:a.x*k,y:a.y*k});
export const dot=(a:Vec,b:Vec)=>a.x*b.x+a.y*b.y;
export const energy=(p:CollisionParameters,a:Vec,b:Vec)=>.5*(p.massA*dot(a,a)+p.massB*dot(b,b));
export const momentum=(p:CollisionParameters,a:Vec,b:Vec)=>add(scale(a,p.massA),scale(b,p.massB));
export function impact(p:CollisionParameters){
 const r=add(p.positionB,p.positionA,-1),u=add(p.velocityB,p.velocityA,-1),R=p.radiusA+p.radiusB,speed2=dot(u,u),ru=dot(r,u);
 if(speed2===0||ru>=0)return null;
 const disc=speed2*R*R-(r.x*u.y-r.y*u.x)**2;
 if(disc<=0)return null;
 const C=dot(r,r)-R*R,time=p.dimensions===1?(Math.abs(r.x)-R)/Math.abs(u.x):C/(-ru+Math.sqrt(disc));if(time<0||time>p.duration)return null;
 const contactA=add(p.positionA,p.velocityA,time),contactB=add(p.positionB,p.velocityB,time),d=add(contactB,contactA,-1),normal=scale(d,1/Math.hypot(d.x,d.y)),vn=dot(u,normal);
 if(vn>=0)return null;
 const ma=p.massA,mb=p.massB,e=p.restitution,impulse=-(1+e)*vn/(1/ma+1/mb);
 const postA=p.dimensions===1?{x:((ma-e*mb)*p.velocityA.x+(1+e)*mb*p.velocityB.x)/(ma+mb),y:0}:add(p.velocityA,normal,-impulse/ma);
 const postB=p.dimensions===1?{x:((mb-e*ma)*p.velocityB.x+(1+e)*ma*p.velocityA.x)/(ma+mb),y:0}:add(p.velocityB,normal,impulse/mb);
 return {time,normal,point:add(contactA,normal,p.radiusA),contactA,contactB,impulse,postA,postB,normal_before:vn,normal_after:dot(add(postB,postA,-1),normal)};
}
export function collision(p:CollisionParameters,time:number){
 const event=impact(p),hit=event!==null&&time>=event.time,velocityA=hit?event!.postA:p.velocityA,velocityB=hit?event!.postB:p.velocityB;
 const positionA=hit?add(event!.contactA,velocityA,time-event!.time):add(p.positionA,velocityA,time),positionB=hit?add(event!.contactB,velocityB,time-event!.time):add(p.positionB,velocityB,time);
 const total=p.massA+p.massB,initialP=momentum(p,p.velocityA,p.velocityB),vcom=scale(initialP,1/total),com0=scale(add(scale(p.positionA,p.massA),scale(p.positionB,p.massB)),1/total),offset=p.frame===1?add(com0,vcom,time):{x:0,y:0},boost=p.frame===1?vcom:{x:0,y:0},before=energy(p,p.velocityA,p.velocityB),after=event?energy(p,event.postA,event.postB):before,K=energy(p,velocityA,velocityB),P=momentum(p,velocityA,velocityB);
 return {state:{time,positionA,positionB,velocityA,velocityB,displayA:add(positionA,offset,-1),displayB:add(positionB,offset,-1),displayVelocityA:add(velocityA,boost,-1),displayVelocityB:add(velocityB,boost,-1),collided:hit,collision_count:Number(hit),event},observables:{momentum:P,kinetic_energy:K,initial_energy:before,post_energy:after,energy_loss:before-K,predicted_energy_loss:before-after,momentum_error:Math.hypot(P.x-initialP.x,P.y-initialP.y),center_of_mass_velocity:vcom,display_momentum:momentum(p,add(velocityA,boost,-1),add(velocityB,boost,-1)),display_kinetic_energy:energy(p,add(velocityA,boost,-1),add(velocityB,boost,-1)),collision_time:event?.time??null,impulse:event?.impulse??0,normal_before:event?.normal_before??null,normal_after:event?.normal_after??null,pre_velocityA:p.velocityA,pre_velocityB:p.velocityB,post_velocityA:event?.postA??p.velocityA,post_velocityB:event?.postB??p.velocityB}};
}
export function collisionPlugin(manifest:Manifest):RegisteredEngine{
 const validate=(raw:unknown)=>{const p=structuredClone(record(raw));exact(p,['massA','massB','radiusA','radiusB','positionA','positionB','velocityA','velocityB','dimensions','restitution','frame','duration']);for(const k of ['positionA','positionB','velocityA','velocityB'])exact(record(p[k]),['x','y']);bounded(p,manifest);const q=p as unknown as CollisionParameters;
 if(!Number.isInteger(q.dimensions)||!Number.isInteger(q.frame))throw new Error('Expected integral dimension/frame choice.');if(q.dimensions===1&&[q.positionA,q.positionB,q.velocityA,q.velocityB].some(v=>v.y!==0))throw new Error('1D requires zero transverse components.');const d=add(q.positionB,q.positionA,-1);if(Math.hypot(d.x,d.y)<q.radiusA+q.radiusB)throw new Error('Initial bodies must not overlap.');return freeze(p);};
 return {id:manifest.id,version:manifest.version,manifest,validateParameters:validate,createInitialState:p=>collision(validate(p) as unknown as CollisionParameters,0).state,evaluate:(raw,query)=>{const p=validate(raw) as unknown as CollisionParameters,t=timeQuery(query);if(!Number.isFinite(t)||t<0||t>p.duration)throw new Error('Unsupported collision duration.');return collision(p,t);}};
}
