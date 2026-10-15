import {experiment} from '../experiments/registry';
import type {Data} from '../experiments/contract';
import {validCamera,type Camera} from './camera';
import {validateLesson,type Lesson} from '../experiments/learning';
export const STORAGE_KEY='vibelearning.workspace';
export interface SavedWorkspace {schema_version:1;experiment_id:string;experiment_version:number;parameters:Data;camera:Camera;viewport_height?:number;visible:{fields:boolean;vectors:boolean;trail:boolean};language:'en'|'zh-CN';lesson?:{plan:Lesson;index:number;progress:number[];answer:string}}
export function validateSaved(raw:unknown):SavedWorkspace{
 if(!raw||typeof raw!=='object')throw new Error('Invalid saved workspace.');const s=raw as SavedWorkspace;
 if(s.schema_version!==1||!['en','zh-CN'].includes(s.language))throw new Error('Unsupported saved workspace version/language.');const e=experiment(s.experiment_id,s.experiment_version),p=e.validateParameters(s.parameters),camera=validCamera(s.camera);
 if(!s.visible||Object.keys(s.visible).sort().join(',')!=='fields,trail,vectors'||Object.values(s.visible).some(v=>typeof v!=='boolean'))throw new Error('Invalid visibility.');
 const height=s.viewport_height??560;if(!Number.isFinite(height)||height<360||height>900)throw new Error('Invalid viewport height.');
 const result:SavedWorkspace={viewport_height:height,schema_version:1,experiment_id:e.id,experiment_version:e.version,parameters:p,camera,visible:{...s.visible},language:s.language};
 if(s.lesson){const l=s.lesson,plan=validateLesson(l.plan,e);if(!Number.isInteger(l.index)||l.index<0||l.index>=plan.steps.length||!Array.isArray(l.progress)||l.progress.length>5||l.progress.some(i=>!Number.isInteger(i)||i<0||i>=plan.steps.length)||typeof l.answer!=='string'||l.answer.length>2000)throw new Error('Invalid saved lesson.');result.lesson={plan,index:l.index,progress:[...l.progress],answer:l.answer};}
 return result;
}
export function readSaved(storage:Pick<Storage,'getItem'>=localStorage):{value:SavedWorkspace|null;error:string}{try{const raw=storage.getItem(STORAGE_KEY);if(!raw)return {value:null,error:''};if(raw.length>100000)throw new Error('Saved workspace is too large.');return {value:validateSaved(JSON.parse(raw)),error:''};}catch{return {value:null,error:'Saved workspace was incompatible or invalid. Loaded paused defaults.'};}}
export function writeSaved(value:SavedWorkspace,storage:Pick<Storage,'setItem'>=localStorage){const safe=validateSaved(value),json=JSON.stringify(safe);if(json.length>100000)throw new Error('Workspace storage limit exceeded.');storage.setItem(STORAGE_KEY,json);}
