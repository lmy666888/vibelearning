import { create } from 'zustand';
import { useSimulationStore } from './simulationStore';
import { capturePlanRequest, planIsCurrent, type PlanRequest } from '../services/actions';
import { validateLesson, validateFeedback, type LessonPlan, type ObservationFeedback } from '../services/learning';
interface Active { plan: LessonPlan; index: number; progress: number[]; answers: Record<string,string>; appliedRevision: number|null }
export type LearningSession = { status:'idle'|'cancelled' } | { status:'generating'; token:string } |
  ({status:'ready'|'experimenting'|'awaiting_observation'|'completed'} & Active) |
  ({status:'awaiting_confirmation'; request:PlanRequest} & Active) |
  ({status:'evaluating'; token:string; request:PlanRequest} & Active) |
  ({status:'feedback'; response:ObservationFeedback} & Active) |
  {status:'error'; message:string; resume?:Active};
function active(s:LearningSession):Active {if(!('plan' in s))throw new Error('No active lesson.');return {plan:s.plan,index:s.index,progress:s.progress,answers:s.answers,appliedRevision:s.appliedRevision};}
interface LearningStore {
  session:LearningSession;
  start:()=>string; loaded:(token:string,plan:LessonPlan)=>void; fail:(message:string)=>void;
  preview:()=>void; confirm:()=>void; cancelPreview:()=>void; observe:()=>void;
  answer:(value:string)=>void; evaluating:()=>{token:string;request:PlanRequest};
  feedback:(token:string,value:ObservationFeedback)=>void; retryAnswer:()=>void; next:()=>void;
  select:(index:number)=>void; restart:()=>void; exit:()=>void; recover:()=>void;
}
export const useLearningStore=create<LearningStore>((set,get)=>({
  session:{status:'idle'},
  start:()=>{if(!['idle','cancelled','error'].includes(get().session.status))throw new Error('Exit the active lesson before starting another.');const token=crypto.randomUUID();set({session:{status:'generating',token}});return token;},
  loaded:(token,plan)=>{const s=get().session;if(s.status!=='generating'||s.token!==token)return;set({session:{status:'ready',plan:validateLesson(plan),index:0,progress:[],answers:{},appliedRevision:null}});},
  fail:message=>{const s=get().session;set({session:{status:'error',message,...('plan'in s?{resume:active(s)}:{})}});},
  preview:()=>{const s=get().session;if(!['ready','experimenting','awaiting_observation','feedback'].includes(s.status))throw new Error('Step cannot be previewed now.');
    set({session:{...active(s),status:'awaiting_confirmation',request:capturePlanRequest('Apply the selected lesson step.',useSimulationStore.getState())}});},
  confirm:()=>{const s=get().session;if(s.status!=='awaiting_confirmation')throw new Error('Confirmation is not expected.');
    useSimulationStore.getState().confirmLessonStep(s.plan,s.index,s.request);
    set({session:{...active(s),status:'experimenting',appliedRevision:useSimulationStore.getState().parameterRevision}});},
  cancelPreview:()=>{const s=get().session;if(s.status!=='awaiting_confirmation')throw new Error('No pending preview.');set({session:{...active(s),status:'ready'}});},
  observe:()=>{const s=get().session;if(s.status!=='experimenting'||s.appliedRevision!==useSimulationStore.getState().parameterRevision)throw new Error('Experiment changed; preview and confirm again.');useSimulationStore.getState().pause();set({session:{...active(s),status:'awaiting_observation'}});},
  answer:value=>{const s=get().session;if(s.status!=='awaiting_observation'||value.length>2000)return;set({session:{...s,answers:{...s.answers,[s.plan.steps[s.index].step_id]:value}}});},
  evaluating:()=>{const s=get().session;if(s.status!=='awaiting_observation'||!s.answers[s.plan.steps[s.index].step_id]?.trim()||s.appliedRevision!==useSimulationStore.getState().parameterRevision)throw new Error('Answer or current experiment is invalid.');
    const token=crypto.randomUUID(),request=capturePlanRequest('Evaluate my observation.',useSimulationStore.getState());set({session:{...active(s),status:'evaluating',token,request}});return {token,request};},
  feedback:(token,value)=>{const s=get().session;if(s.status!=='evaluating'||s.token!==token)return;
    if(!planIsCurrent(s.request,useSimulationStore.getState())){get().fail('Experiment changed while feedback was pending. Preview the step again.');return;}
    const response=validateFeedback(value,s.plan,s.index);set({session:{...active(s),status:'feedback',response,
      progress:response.assessment==='correct'&&response.next_action==='continue'?[...new Set([...s.progress,s.index])]:s.progress}});},
  retryAnswer:()=>{const s=get().session;if(s.status!=='feedback')throw new Error('No feedback to retry.');set({session:{...active(s),status:'awaiting_observation'}});},
  next:()=>{const s=get().session;if(s.status!=='feedback'||(s.response.assessment!=='correct'||s.response.next_action!=='continue')||s.appliedRevision!==useSimulationStore.getState().parameterRevision)throw new Error('A current, correct observation is required.');
    set({session:s.index===s.plan.steps.length-1?{...active(s),status:'completed'}:{...active(s),status:'ready',index:s.index+1,appliedRevision:null}});},
  select:index=>{const s=get().session;if(!['ready','experimenting','awaiting_observation','feedback','completed'].includes(s.status))throw new Error('Cannot navigate during pending work.');const a=active(s);
    if(!Number.isInteger(index)||index<0||index>=a.plan.steps.length||index>0&&!a.progress.includes(index-1))throw new Error('Complete the previous observation first.');
    set({session:{...a,status:'ready',index,appliedRevision:null}});},
  restart:()=>{const s=get().session;if(!['ready','experimenting','awaiting_observation','feedback','completed'].includes(s.status))throw new Error('Cannot restart during pending work.');const a=active(s);set({session:{...a,status:'ready',index:0,progress:[],answers:{},appliedRevision:null}});},
  exit:()=>set({session:{status:'cancelled'}}),
  recover:()=>{const s=get().session;if(s.status!=='error')return;set({session:s.resume?{...s.resume,status:'ready',appliedRevision:null}:{status:'idle'}});},
}));
