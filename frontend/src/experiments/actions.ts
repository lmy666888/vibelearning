import type {Data,RegisteredEngine} from './contract';
import {exact,record,put,get,freeze,close} from './validation';
import {experiment} from './registry';
import type {ContextV2} from './context';
import {validateRegionAction,applyRegion,type RegionAction} from './regionActions';
export type Action=RegionAction|({schema_version:1}&({action:'set_parameter';target:string;value:number}|{action:'scale_parameter';target:string;factor:number}|{action:'select_preset';preset_id:string}|{action:'reset_simulation'}));
export function validateAction(value:unknown,engine:RegisteredEngine):Action{
 const a=record(value);if(a.schema_version!==1||!engine.manifest.operations.includes(String(a.action)))throw new Error('Unsupported action/version.');
 if(String(a.action).endsWith('_field_region'))return freeze(validateRegionAction(a));
 if(a.action==='set_parameter'||a.action==='scale_parameter'){
  const k=a.action==='set_parameter'?'value':'factor';exact(a,['schema_version','action','target',k]);
  if(!engine.manifest.parameters.some(c=>!c.readonly&&c.target===a.target)||typeof a[k]!=='number'||!Number.isFinite(a[k])||(k==='factor'&&(Number(a[k])<=0||Number(a[k])>10)))throw new Error('Unsupported parameter or value.');
 }else if(a.action==='select_preset'){exact(a,['schema_version','action','preset_id']);if(!engine.manifest.presets.some(p=>p.id===a.preset_id))throw new Error('Unknown preset.');}
 else exact(a,['schema_version','action']);return freeze(structuredClone(a)) as Action;
}
export function applyActions(engine:RegisteredEngine,before:Data,raw:unknown[]):Data{
 if(!Array.isArray(raw)||raw.length<1||raw.length>3)throw new Error('Expected 1–3 actions.');let p=structuredClone(engine.validateParameters(before));const seen=new Set<string>();
 raw.forEach((v,i)=>{const a=validateAction(v,engine);
  if(a.action==='set_parameter'||a.action==='scale_parameter'){if(seen.has(a.target))throw new Error('Duplicate parameter change.');seen.add(a.target);put(p,a.target,a.action==='set_parameter'?a.value:Number(get(p,a.target))*a.factor);}
  else if(a.action==='select_preset'){if(i!==0)throw new Error('Preset must precede changes.');p=structuredClone(engine.manifest.presets.find(v=>v.id===a.preset_id)!.parameters);}
  else if(a.action.endsWith('_field_region'))p=structuredClone(applyRegion(engine,p,a as RegionAction));
  else if(raw.length!==1)throw new Error('Reset must be the sole action.');p=structuredClone(engine.validateParameters(p));
 });return freeze(p);
}
export const preview=(engine:RegisteredEngine,p:Data)=>engine.evaluate(p,engine.manifest.initial_query).observables;
export interface Proposal {status:'proposal';action:Action;explanation:string;experiment_id:string;experiment_version:number;before:Data;after:Data;before_observables:Data;after_observables:Data;snapshot_id:string;revision:number;requires_confirmation:true}
export function validateProposal(value:unknown,c:ContextV2):Proposal{
 const v=record(value);exact(v,['status','action','explanation','experiment_id','experiment_version','before','after','before_observables','after_observables','snapshot_id','revision','requires_confirmation']);
 if(v.status!=='proposal'||v.requires_confirmation!==true||v.experiment_id!==c.experiment_id||v.experiment_version!==c.experiment_version||v.snapshot_id!==c.snapshot_id||v.revision!==c.revision||!close(v.before,c.parameters)||typeof v.explanation!=='string'||!v.explanation.trim()||v.explanation.length>240)throw new Error('Proposal identity/confirmation invalid.');
 const e=experiment(c.experiment_id,c.experiment_version),a=validateAction(v.action,e),after=applyActions(e,c.parameters,[a]);
 if(!close(v.after,after)||!close(v.before_observables,c.observables)||!close(v.after_observables,preview(e,after)))throw new Error('Proposal predictions invalid.');
 return freeze(structuredClone(v)) as unknown as Proposal;
}
