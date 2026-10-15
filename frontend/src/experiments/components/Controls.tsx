import {useState,useEffect} from 'react';
import {useStore} from 'zustand';
import type {Runtime} from '../runtime';
import {get,put} from '../validation';
import type {ParameterDefinition} from '../contract';
function Field({runtime,c}:{runtime:Runtime;c:ParameterDefinition}){
 const p=useStore(runtime.store,s=>s.parameters);const value=Number(get(p,c.target))/c.scale;const [draft,setDraft]=useState(String(value)),[error,setError]=useState('');
 useEffect(()=>{setDraft(String(Number(value.toPrecision(10))));setError('');},[p,value]);
 return <div className="control"><label htmlFor={`plugin-${c.id}`}>{c.label} ({c.unit})</label><input id={`plugin-${c.id}`} type="number" min={c.min} max={c.max} step={c.step} value={draft} aria-invalid={!!error} onChange={event=>{setDraft(event.target.value);const v=Number(event.target.value);if(!event.target.value.trim()||!Number.isFinite(v)){setError('Enter a finite value.');return;}try{const next=structuredClone(p);put(next,c.target,v*c.scale);runtime.commit(next,runtime.context());setError('');}catch(e){setError((e as Error).message);}}}/>{error&&<p role="alert">{error}</p>}</div>;
}
export function PluginControls({runtime}:{runtime:Runtime}){
 const status=useStore(runtime.store,s=>s.status),speed=useStore(runtime.store,s=>s.speed);const [error,setError]=useState('');
 return <aside className="panel controls"><h2>Experiment parameters</h2>{runtime.engine.manifest.parameters.filter(c=>!c.readonly).map(c=><Field key={c.target} runtime={runtime} c={c}/>)}
 <label>Simulation speed <select aria-label="Simulation speed" value={speed} onChange={e=>runtime.store.setState({speed:Number(e.target.value)})}>{[.25,1,2].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
 <div className="buttons"><button onClick={status==='running'?runtime.pause:runtime.play}>{status==='running'?'Pause':'Play'}</button><button onClick={runtime.reset}>Reset</button></div><button onClick={runtime.clearTrajectory}>Clear trajectory</button>
 <h3>Experiment presets</h3>{runtime.engine.manifest.presets.map(p=><button className="preset-card" key={p.id} onClick={()=>{try{runtime.commit(p.parameters,runtime.context());setError('');}catch(e){setError((e as Error).message);}}}><strong>{p.title}</strong><span>{p.description}</span><span>{p.objective}</span><span>{p.expected}</span></button>)}{error&&<p role="alert">{error}</p>}
 </aside>;
}
