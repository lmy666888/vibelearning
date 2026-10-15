import {useEffect,useState} from 'react';
import {useSimulationStore} from '../../stores/simulationStore';
import type {SimulationParameters} from '../../simulations/physics/uniform-electric-field/types';
import { controls, parameterValue } from '../../simulations/physics/uniform-electric-field/controls';
function value(p:SimulationParameters,id:string){const c=controls.find(c=>c.id===id)!;return parameterValue(p,c.target)/c.scale;}
function Field({id,label,unit,min,max,step}:typeof controls[number]){
 const parameters=useSimulationStore(s=>s.parameters),update=useSimulationStore(s=>s.updateParameters);const [error,setError]=useState('');const current=value(parameters,id);
 const [draft,setDraft]=useState(String(Number(current.toFixed(5))));
 useEffect(()=>{setDraft(String(Number(value(parameters,id).toFixed(5))));setError('');},[parameters,id]);
 const change=(raw:string)=>{setDraft(raw);const n=Number(raw);if(raw.trim()===''||!Number.isFinite(n)||n<min||n>max){setError(`请输入 ${min} 至 ${max} ${unit}`);return;}const p={...parameters,field:{...parameters.field},initialVelocity:{...parameters.initialVelocity}};
 if(id==='charge')p.charge=n*1e-9;else if(id==='mass')p.mass=n*1e-6;else if(id==='ex')p.field.x=n;else if(id==='ey')p.field.y=n;else if(id==='vx')p.initialVelocity.x=n;else p.initialVelocity.y=n;
 try{update(p);setError('');}catch{setError('参数无效');}};
 return <div className="control"><label htmlFor={id}>{label}<span>{unit}</span></label><div className="input-row"><input id={id} type="number" min={min} max={max} step={step} value={draft} onChange={e=>change(e.target.value)} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined}/><input aria-label={`${label}滑块`} type="range" min={min} max={max} step={step} value={current} onChange={e=>change(e.target.value)}/></div>{error&&<small id={`${id}-error`} role="alert">{error}</small>}</div>;
}
export function ControlPanel(){const status=useSimulationStore(s=>s.status),play=useSimulationStore(s=>s.play),pause=useSimulationStore(s=>s.pause),reset=useSimulationStore(s=>s.reset),error=useSimulationStore(s=>s.error);return <aside className="panel controls"><span className="eyebrow">EXPERIMENT SETTINGS</span><h2>实验参数</h2><p className="muted">改变一个变量，观察运动如何变化。</p><div className="controls-list">{controls.map(c=><Field key={c.id} {...c}/>)}</div><div className="buttons"><button className="primary" onClick={status==='running'?pause:play}>{status==='running'?'Ⅱ 暂停':'▶ 播放'}</button><button onClick={reset}>↺ 重置</button></div><p className="control-note">修改参数后暂停并回到 t = 0。时间比例 1×。</p>{error&&<p role="alert">{error}</p>}</aside>;}
