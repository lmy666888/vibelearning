import type {Data,RegisteredEngine} from './contract';
import {record,exact,freeze,close} from './validation';
import {applyActions,preview,type Action} from './actions';
export interface Step{step_id:string;title:string;objective:string;experiment_actions:Action[];expected_behavior:string;observation_question:string;expected_concepts:string[];explanation:string;completion_criteria:'submit_observation';before:Data;after:Data;predicted_observables:Data;requires_confirmation:true}
export interface Lesson{status:'lesson';schema_version:2;experiment_id:string;experiment_version:number;lesson_id:string;title:string;language:'zh-CN'|'en';learning_objectives:string[];initial_parameters:Data;steps:Step[]}
function text(v:unknown):asserts v is string{if(typeof v!=='string'||!v.trim()||v.length>240)throw new Error('Invalid lesson text.');}
function texts(v:unknown){if(!Array.isArray(v)||v.length<1||v.length>5)throw new Error('Invalid concept list.');v.forEach(text);}
export function validateLesson(value:unknown,e:RegisteredEngine):Lesson{
 const v=record(value);exact(v,['status','schema_version','experiment_id','experiment_version','lesson_id','title','language','learning_objectives','initial_parameters','steps']);
 if(v.status!=='lesson'||v.schema_version!==2||v.experiment_id!==e.id||v.experiment_version!==e.version||!['zh-CN','en'].includes(String(v.language))||typeof v.lesson_id!=='string'||! /^[a-f0-9-]{36}$/.test(v.lesson_id)||!Array.isArray(v.steps)||v.steps.length<1||v.steps.length>5)throw new Error('Incompatible lesson identity/schema.');text(v.title);texts(v.learning_objectives);
 let p=e.validateParameters(v.initial_parameters);
 v.steps.forEach((raw,i)=>{const s=record(raw);exact(s,['step_id','title','objective','experiment_actions','expected_behavior','observation_question','expected_concepts','explanation','completion_criteria','before','after','predicted_observables','requires_confirmation']);
 if(s.step_id!==`step-${i+1}`||s.requires_confirmation!==true||s.completion_criteria!=='submit_observation')throw new Error('Invalid step/confirmation.');
 ['title','objective','expected_behavior','observation_question','explanation'].forEach(k=>text(s[k]));texts(s.expected_concepts);
 const after=applyActions(e,p,s.experiment_actions as unknown[]);if(!close(s.before,p)||!close(s.after,after)||!close(s.predicted_observables,preview(e,after)))throw new Error('Sequential science verification failed.');p=after;});
 return freeze(structuredClone(v)) as unknown as Lesson;
}
