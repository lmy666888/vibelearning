import {createStore,type StoreApi} from 'zustand/vanilla';
import {useSimulationStore as electricStore,defaults} from '../stores/simulationStore';
import {experiment} from './registry';
import type {Data,RegisteredEngine} from './contract';
import type {ContextV2} from './context';
import {makeContext} from './context';
import {close,freeze} from './validation';
import {boris,lorentzObservables,type LorentzParameters,type LorentzState} from './lorentz';
export interface RuntimeState{error:string|null;parameters:Data;query:Data;revision:number;status:'paused'|'running';state:Data;observables:Data;trace:{x:number;y:number}[];speed:number}
let revisionSequence=0;
const nextRevision=()=>++revisionSequence;
export interface Runtime{active:boolean;engine:RegisteredEngine;store:StoreApi<RuntimeState>;context:()=>ContextV2;commit:(p:Data,c:ContextV2)=>void;play:()=>void;pause:()=>void;reset:()=>void;advance:(dt:number)=>void;clearTrajectory:()=>void;destroy:()=>void}
export function isCurrent(runtime:Runtime,c:ContextV2){const s=runtime.store.getState();return runtime.active&&runtime.engine.id===c.experiment_id&&runtime.engine.version===c.experiment_version&&s.revision===c.revision&&close(s.parameters,c.parameters);}
function snapshot(engine:RegisteredEngine,p:Data,time:number,revision:number):RuntimeState{const result=engine.evaluate(p,{time});return {error:null,parameters:p,query:{time},revision,status:'paused',state:result.state,observables:result.observables,trace:[],speed:1};}
function electricRuntime(engine:RegisteredEngine):Runtime{
 electricStore.setState(s=>({parameters:defaults,time:0,status:'paused',error:null,activePresetId:null,baseline:null,currentLessonStepId:'observe-positive',parameterRevision:s.parameterRevision+1}));
 let previousRevision=-1,mappedRevision=0;
 const read=()=>{const s=electricStore.getState();if(s.parameterRevision!==previousRevision){mappedRevision=nextRevision();previousRevision=s.parameterRevision;}return {...snapshot(engine,s.parameters as unknown as Data,Math.min(s.time,60),mappedRevision),status:s.status};};
 const store=createStore<RuntimeState>(()=>read());const unsub=electricStore.subscribe(()=>{store.setState(read());if(electricStore.getState().time>60)electricStore.setState({time:60,status:'paused'});});
 const runtime:Runtime={active:true,engine,store,context:()=>{const s=store.getState();return makeContext(engine.id,s.parameters,s.query,s.revision);},
 commit:(p,c)=>{if(!isCurrent(runtime,c))throw new Error('Stale or cross-experiment proposal.');const checked=engine.validateParameters(p);electricStore.getState().updateParameters(checked as unknown as typeof defaults);},
 play:()=>electricStore.getState().play(),pause:()=>electricStore.getState().pause(),reset:()=>electricStore.getState().reset(),advance:dt=>electricStore.getState().advance(dt),clearTrajectory:()=>electricStore.getState().reset(),destroy:()=>{runtime.active=false;electricStore.getState().pause();unsub();}};return runtime;
}
function lorentzRuntime(engine:RegisteredEngine):Runtime{
 const initial=engine.validateParameters(engine.manifest.presets[2].parameters);const store=createStore<RuntimeState>(()=>snapshot(engine,initial,0,nextRevision()));let accumulator=0;
 const runtime:Runtime={active:true,engine,store,context:()=>{const s=store.getState();return makeContext(engine.id,s.parameters,s.query,s.revision);},
 commit:(p,c)=>{store.setState(s=>{if(!isCurrent(runtime,c))throw new Error('Stale or cross-experiment proposal.');accumulator=0;return snapshot(engine,engine.validateParameters(p),0,nextRevision());});},
 play:()=>store.setState({status:'running'}),pause:()=>store.setState({status:'paused'}),
 reset:()=>{const s=store.getState();runtime.commit(s.parameters,runtime.context());},
 advance:dt=>{if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid frame duration.');const s=store.getState();if(s.status!=='running')return;
 const p=s.parameters as unknown as LorentzParameters;accumulator+=Math.min(dt,.05)*s.speed;let state=s.state as unknown as LorentzState;const trace=[...s.trace];let steps=0;
 while(accumulator+1e-12>=p.timeStep&&Number(state.time)+p.timeStep<=p.duration+1e-10&&steps<1000){state=boris(p,state,p.timeStep);accumulator-=p.timeStep;trace.push({...state.position});steps++;}
 state.time=Math.min(state.time,p.duration);const observables=lorentzObservables(p,state);if(p.field.x===0&&p.field.y===0&&Math.abs(Number(observables.speed)-Math.hypot(p.initialVelocity.x,p.initialVelocity.y))>Math.max(1e-11,Math.hypot(p.initialVelocity.x,p.initialVelocity.y)*5e-10))throw new Error('Magnetic energy error exceeded tolerance.');store.setState({state:state as unknown as Data,observables,query:{time:state.time},trace:trace.slice(-2000),status:state.time+p.timeStep>p.duration+1e-10?'paused':'running'});},
 clearTrajectory:()=>store.setState({trace:[]}),destroy:()=>{runtime.active=false;store.setState({status:'paused'});}};return runtime;
}
const factories:Record<string,(engine:RegisteredEngine)=>Runtime>={'uniform-electric-field':electricRuntime,'lorentz-force-2d':lorentzRuntime};
export function createRuntime(id:string):Runtime{const engine=experiment(id);return factories[id](engine);}
/** Switching discards parameter/animation state and invalidates every pending proposal/lesson. */
export const platformStore=createStore<{runtime:Runtime;epoch:number;switchExperiment:(id:string)=>void}>((set,get)=>({runtime:createRuntime('uniform-electric-field'),epoch:0,switchExperiment:id=>{experiment(id);get().runtime.destroy();set({runtime:createRuntime(id),epoch:get().epoch+1});}}));
