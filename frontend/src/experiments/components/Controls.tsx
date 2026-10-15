import {useState,useEffect} from 'react';
import {useStore} from 'zustand';
import type {Runtime} from '../runtime';
import {get,put} from '../validation';
import {useLanguageStore} from '../../stores/languageStore';
import type {ParameterDefinition} from '../contract';
export function Field({runtime,c}:{runtime:Runtime;c:ParameterDefinition}){
 const language=useLanguageStore(s=>s.language),labels:Record<string,[string,string]>={charge:['Charge q','电荷 q'],mass:['Mass m','质量 m'],'field.x':['Electric field Ex','电场 Ex'],'field.y':['Electric field Ey','电场 Ey'],magneticFieldZ:['Magnetic field Bz','磁场 Bz'],'initialPosition.x':['Initial position x','初位置 x'],'initialPosition.y':['Initial position y','初位置 y'],'initialVelocity.x':['Initial velocity vx','初速度 vx'],'initialVelocity.y':['Initial velocity vy','初速度 vy'],timeStep:['Fixed timestep','固定步长'],duration:['Maximum duration','最大时长']},label=labels[c.target]?.[language==='zh-CN'?1:0]??c.label;
 const p=useStore(runtime.store,s=>s.parameters);const value=Number(get(p,c.target))/c.scale;const [draft,setDraft]=useState(String(value)),[error,setError]=useState('');
 useEffect(()=>{setDraft(String(Number(value.toPrecision(10))));setError('');},[p,value]);
 return <div className="control"><label htmlFor={`plugin-${c.id}`}>{label} ({c.unit})</label><input id={`plugin-${c.id}`} type="text" inputMode="decimal" min={c.min} max={c.max} step={c.step} value={draft} aria-invalid={!!error} onChange={event=>{setDraft(event.target.value);const v=Number(event.target.value);if(!event.target.value.trim()||!Number.isFinite(v)){setError('Enter a finite value.');return;}try{const next=structuredClone(p);put(next,c.target,v*c.scale);runtime.commit(next,runtime.context());setError('');}catch(e){setError((e as Error).message);}}}/><input className="lab-range" type="range" aria-label={`${label} slider`} min={c.min} max={c.max} step={c.step} value={value} onChange={e=>{try{const next=structuredClone(p);put(next,c.target,Number(e.target.value)*c.scale);runtime.commit(next,runtime.context());setError('');}catch(err){setError((err as Error).message);}}}/>{error&&<p role="alert">{error}</p>}</div>;
}
export function PluginControls({runtime}:{runtime:Runtime}){
 const status=useStore(runtime.store,s=>s.status),speed=useStore(runtime.store,s=>s.speed);const [error,setError]=useState('');
 return <aside className="panel controls"><h2>Experiment parameters</h2>{runtime.engine.manifest.parameters.filter(c=>!c.readonly).map(c=><Field key={c.target} runtime={runtime} c={c}/>)}
 <label>Simulation speed <select aria-label="Simulation speed" value={speed} onChange={e=>runtime.store.setState({speed:Number(e.target.value)})}>{[.25,1,2].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>
 <div className="buttons"><button onClick={status==='running'?runtime.pause:runtime.play}>{status==='running'?'Pause':'Play'}</button><button onClick={runtime.reset}>Reset</button></div><button onClick={runtime.clearTrajectory}>Clear trajectory</button>
 <h3>Experiment presets</h3>{runtime.engine.manifest.presets.map(p=><button className="preset-card" key={p.id} onClick={()=>{try{runtime.commit(p.parameters,runtime.context());setError('');}catch(e){setError((e as Error).message);}}}><strong>{p.title}</strong><span>{p.description}</span><span>{p.objective}</span><span>{p.expected}</span></button>)}{error&&<p role="alert">{error}</p>}
 </aside>;
}
