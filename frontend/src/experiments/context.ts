import {experiment} from './registry';
import {freeze,fingerprint,close,exact,record} from './validation';
import type {Data} from './contract';
export interface ContextV2 {schema_version:2;experiment_id:string;experiment_version:number;parameters:Data;query:Data;simulation_state:Data;observables:Data;revision:number;snapshot_id:string}
export function makeContext(id:string,parameters:Data,query:Data,revision:number):ContextV2{
 const engine=experiment(id),p=engine.validateParameters(parameters),result=engine.evaluate(p,query);
 const data={schema_version:2 as const,experiment_id:id,experiment_version:engine.version,parameters:p,query:structuredClone(query),simulation_state:result.state,observables:result.observables,revision};
 return freeze({...data,snapshot_id:fingerprint({schema_version:data.schema_version,experiment_id:id,experiment_version:engine.version,parameters:p,query:data.query,revision})});
}
export function validateContext(value:unknown):ContextV2{
 const c=record(value);exact(c,['schema_version','experiment_id','experiment_version','parameters','query','simulation_state','observables','revision','snapshot_id']);
 if(c.schema_version!==2||typeof c.experiment_id!=='string'||!Number.isSafeInteger(c.revision)||Number(c.revision)<0)throw new Error('Invalid context version/identity.');
 experiment(c.experiment_id,Number(c.experiment_version));const expected=makeContext(c.experiment_id,record(c.parameters),record(c.query),Number(c.revision));
 if(!close(c,expected))throw new Error('Snapshot or derived science is inconsistent.');return expected;
}
