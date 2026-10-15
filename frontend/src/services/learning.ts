import { applyAction, keys, object, same, physicsPreview, validateAction, type Action, type PhysicsPreview, type PlanRequest } from './actions';
import { checkControlBounds } from '../simulations/physics/uniform-electric-field/controls';
import type { SimulationParameters } from '../simulations/physics/uniform-electric-field/types';
import type { Language } from '../stores/languageStore';
import { controls } from '../simulations/physics/uniform-electric-field/controls';
export const capabilities = { simulation_id: 'uniform-electric-field-2d', operations: ['set_parameter','scale_parameter','select_preset','reset_simulation'], parameter_targets: controls.map(c=>c.target) };
export interface LessonStep {
  step_id: string; title: string; objective: string; experiment_actions: Action[]; expected_behavior: string;
  observation_question: string; expected_concepts: string[]; explanation: string; completion_criteria: 'submit_observation';
  before: SimulationParameters; after: SimulationParameters; predicted_physics: PhysicsPreview; requires_confirmation: true;
}
export interface LessonPlan {
  status: 'lesson'; schema_version: 1; lesson_id: string; title: string; language: Language; learning_objectives: string[];
  initial_parameters: SimulationParameters; steps: LessonStep[]; metadata: { provider_model: string; generated_at: string };
}
export interface UnsupportedLesson { status: 'unsupported_capability'; language: Language; reason: string }
export type LessonResult = LessonPlan | UnsupportedLesson;
export interface ObservationFeedback {
  assessment: 'correct'|'partially_correct'|'incorrect'|'needs_clarification'; feedback: string; explanation: string; hint: string|null;
  next_action: 'retry'|'continue'; lesson_id: string; step_id: string; authoritative_physics: PhysicsPreview;
}
function prose(value: unknown, language: Language, limit=240): asserts value is string {
  if(typeof value!=='string'||!value.trim()||value.length>limit || (language==='en' ? /[\u3400-\u9fff]/.test(value) : !/[\u3400-\u9fff]/.test(value))) throw new Error('Invalid or inconsistent lesson language.');
}
function list(value: unknown, language: Language): asserts value is string[] {
  if(!Array.isArray(value)||value.length<1||value.length>5)throw new Error('Invalid learning concepts.');
  value.forEach(v=>prose(v,language));
}
function parameters(value: unknown): SimulationParameters {
  const p=object(value);keys(p,['charge','mass','field','initialPosition','initialVelocity']);
  for(const k of ['field','initialPosition','initialVelocity']) {const v=object(p[k]);keys(v,['x','y']);if(typeof v.x!=='number'||typeof v.y!=='number')throw new Error('Invalid vector.');}
  if(typeof p.charge!=='number'||typeof p.mass!=='number')throw new Error('Invalid parameters.');
  const typed=p as unknown as SimulationParameters;checkControlBounds(typed);physicsPreview(typed);return typed;
}
export function applyStep(before: SimulationParameters, actions: unknown[]): SimulationParameters {
  if(!Array.isArray(actions)||actions.length<1||actions.length>3)throw new Error('A step needs 1–3 actions.');
  let result=before;const targets=new Set<string>();
  actions.forEach((raw,i)=>{const a=validateAction(raw);
    if(a.action==='select_preset'&&i!==0||a.action==='reset_simulation'&&actions.length!==1)throw new Error('Contradictory step.');
    if(a.action==='set_parameter'||a.action==='scale_parameter'){if(targets.has(a.target))throw new Error('Duplicate parameter change.');targets.add(a.target);}
    result=applyAction(result,a);
  });return result;
}
export function validateLesson(value: unknown, initial?: SimulationParameters): LessonPlan {
  const p=object(value);keys(p,['status','schema_version','lesson_id','title','language','learning_objectives','initial_parameters','steps','metadata']);
  if(p.status!=='lesson'||p.schema_version!==1||typeof p.lesson_id!=='string'||! /^[a-f0-9-]{36}$/.test(p.lesson_id)||(p.language!=='en'&&p.language!=='zh-CN'))throw new Error('Unsupported lesson schema.');
  const language=p.language;prose(p.title,language);list(p.learning_objectives,language);
  let current=parameters(p.initial_parameters);
  if(initial&&!same(initial,current))throw new Error('Lesson initial snapshot changed.');
  if(!Array.isArray(p.steps)||p.steps.length<1||p.steps.length>5)throw new Error('Lesson must have 1–5 steps.');
  p.steps.forEach((raw,i)=>{const s=object(raw);keys(s,['step_id','title','objective','experiment_actions','expected_behavior','observation_question','expected_concepts','explanation','completion_criteria','before','after','predicted_physics','requires_confirmation']);
    if(s.step_id!==`step-${i+1}`||s.completion_criteria!=='submit_observation'||s.requires_confirmation!==true)throw new Error('Invalid step identity or confirmation.');
    ['title','objective','expected_behavior','observation_question','explanation'].forEach(k=>prose(s[k],language));list(s.expected_concepts,language);
    const after=applyStep(current,s.experiment_actions as unknown[]);
    if(!same(s.before,current)||!same(s.after,after)||!same(s.predicted_physics,physicsPreview(after)))throw new Error('Lesson sequential physics failed verification.');
    current=after;
  });
  const m=object(p.metadata);keys(m,['provider_model','generated_at']);
  if(typeof m.provider_model!=='string'||!m.provider_model||m.provider_model.length>160||typeof m.generated_at!=='string'||!Number.isFinite(Date.parse(m.generated_at)))throw new Error('Invalid generation metadata.');
  return deepFreeze(structuredClone(p)) as unknown as LessonPlan;
}
function deepFreeze<T>(v:T):T {if(v&&typeof v==='object'){Object.values(v).forEach(deepFreeze);Object.freeze(v);}return v;}
async function post(path:string,data:unknown,signal?:AbortSignal):Promise<unknown>{
  const response=await fetch(`${import.meta.env.VITE_API_BASE_URL??''}/api/ai/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(130000)])});
  if(!response.ok){const body=await response.json().catch(()=>null);const code=body?.detail?.code;
    const messages:Record<string,string>={language_mismatch:'The AI response did not match your language preference. Retry without changing the experiment.',provider_rate_limited:'Provider quota or rate limit reached. Retry later.',provider_timeout:'The AI provider timed out. Please retry.',invalid_action:'The lesson or experiment transition is invalid. Preview the step again.',inconsistent_physics:'The experiment snapshot failed physics verification. Reset and retry.'};
    throw new Error(messages[code]??'Learning service unavailable or response invalid. Check the backend and retry.');
  }return response.json();
}
export async function generateLesson(goal:string,language:Language,request:PlanRequest,signal?:AbortSignal):Promise<LessonResult>{
  const data=object(await post('generate-lesson',{learning_goal:goal,preferred_language:language,simulation_context:request.simulation_context,capabilities},signal));
  if(data.status==='unsupported_capability'){keys(data,['status','language','reason']);if(data.language!==language)throw new Error('Response language mismatch.');prose(data.reason,language);return data as unknown as UnsupportedLesson;}
  const plan=validateLesson(data,request.simulation_context.parameters);if(plan.language!==language)throw new Error('Response language mismatch.');return plan;
}
export function validateFeedback(value:unknown,lesson:LessonPlan,index:number):ObservationFeedback{
  const d=object(value);keys(d,['assessment','feedback','explanation','hint','next_action','lesson_id','step_id','authoritative_physics']);
  if(!['correct','partially_correct','incorrect','needs_clarification'].includes(d.assessment as string)||!['retry','continue'].includes(d.next_action as string)||d.assessment!=='correct'&&d.next_action!=='retry'||d.lesson_id!==lesson.lesson_id||d.step_id!==lesson.steps[index].step_id||!same(d.authoritative_physics,lesson.steps[index].predicted_physics))throw new Error('Invalid observation feedback.');
  prose(d.feedback,lesson.language,2000);prose(d.explanation,lesson.language,2000);if(d.hint!==null)prose(d.hint,lesson.language);
  return deepFreeze(structuredClone(d)) as unknown as ObservationFeedback;
}
export async function evaluateObservation(lesson:LessonPlan,index:number,answer:string,request:PlanRequest,signal?:AbortSignal){
  return validateFeedback(await post('evaluate-observation',{lesson,step_id:lesson.steps[index].step_id,student_answer:answer,simulation_context:request.simulation_context,preferred_language:lesson.language},signal),lesson,index);
}
