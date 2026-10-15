/** Engine contract: no React, particle, time, charge or integration assumptions. */
export interface ExperimentPlugin<P,S,O,Q> {
  readonly id:string; readonly version:number;
  validateParameters(input:unknown):P;
  createInitialState(parameters:P):S;
  evaluate(parameters:P,query:Q):{state:S;observables:O};
}
export interface ParameterDefinition {id:string;target:string;label:string;unit:string;min:number;max:number;step:number;scale:number;readonly?:boolean}
export interface Manifest {
 id:string;version:number;title:string;subject:string;description:string;parameters:ParameterDefinition[];operations:string[];
 observables:{id:string;label:string;unit:string}[];presets:{id:string;title:string;description:string;objective:string;expected:string;parameters:Record<string,unknown>}[];
 initial_query:Data;equations:string[];renderer:string;evolution:{kind:string;max_duration:number;dt?:number};lesson_capabilities:string[];limitations:string[];
}
export type Data=Record<string,unknown>;
export interface RegisteredEngine extends ExperimentPlugin<Data,Data,Data,Data>{manifest:Manifest}
