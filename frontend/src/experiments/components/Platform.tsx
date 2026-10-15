import {useStore} from 'zustand';
import {useState} from 'react';
import {platformStore} from '../runtime';
import {experiments} from '../registry';
import {Header} from '../../components/layout/Header';
import {SimulationCanvas} from '../../components/simulation/SimulationCanvas';
import {ControlPanel} from '../../components/simulation/ControlPanel';
import {ExperimentPresets} from '../../components/simulation/ExperimentPresets';
import {GuidedLesson} from '../../components/learning/GuidedLesson';
import {SimulationInfo} from '../../components/simulation/SimulationInfo';
import {ExperimentComparison} from '../../components/simulation/ExperimentComparison';
import {LorentzCanvas} from './LorentzCanvas';
import {PluginControls} from './Controls';
import {Observables,ObservableTable} from './Observables';
import {PlatformAI} from './PlatformAI';
import {useLanguageStore,type Language} from '../../stores/languageStore';
import type {Runtime} from '../runtime';
import type {Data} from '../contract';
function ElectricPresentation(){return <><div className="workspace"><SimulationCanvas/><ControlPanel/></div><div className="day2-learning"><ExperimentPresets/><GuidedLesson/></div><SimulationInfo/><ExperimentComparison/></>;}
function LorentzPresentation({runtime}:{runtime:Runtime}){const [baseline,setBaseline]=useState<Data|null>(null);const current=useStore(runtime.store,s=>s.observables);return <><div className="workspace"><LorentzCanvas runtime={runtime}/><PluginControls runtime={runtime}/></div><Observables runtime={runtime}/><section className="panel comparison-panel"><h2>Experiment Comparison</h2><button onClick={()=>setBaseline(structuredClone(current))}>Save baseline</button><button disabled={!baseline} onClick={()=>setBaseline(null)}>Clear baseline</button>{baseline&&<ObservableTable runtime={runtime} before={baseline} after={current}/>}</section></>;}
const presentations:Record<string,({runtime}:{runtime:Runtime})=>React.ReactNode>={'electric-canvas':()=> <ElectricPresentation/>,'lorentz-canvas':({runtime})=><LorentzPresentation runtime={runtime}/>};
export function ExperimentPlatform(){const {runtime,epoch,switchExperiment}=useStore(platformStore);const language=useLanguageStore(s=>s.language),setLanguage=useLanguageStore(s=>s.setLanguage);const Presentation=presentations[runtime.engine.manifest.renderer];
 return <><Header/><main><section className="intro"><div><span className="eyebrow">REGISTERED SCIENTIFIC EXPERIMENTS</span><h1>VibeLearning AI · 实验平台</h1><p>Deterministic models · Reviewed AI proposals · Student-controlled learning</p></div></section><div className="learning-mode-bar"><label>Experiment <select aria-label="Experiment" value={runtime.engine.id} onChange={e=>switchExperiment(e.target.value)}>{experiments.map(p=><option key={p.id} value={p.id}>{p.manifest.title}</option>)}</select></label><label>AI response language <select aria-label="AI response language" value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="en">English</option><option value="zh-CN">简体中文</option></select></label></div>
 <section className="panel learning-panel"><h2>{runtime.engine.manifest.title}</h2><p>{runtime.engine.manifest.description}</p><p>Switching experiments pauses and discards the old experiment state, proposals and active lesson. The selected experiment loads its defaults.</p><p>{runtime.engine.manifest.limitations.join(' ')}</p></section>
 <div key={`${runtime.engine.id}-${epoch}`}><Presentation runtime={runtime}/><PlatformAI runtime={runtime}/></div><footer>VibeLearning AI <a href="/?context=v1">Classic electric-field view</a></footer></main></>;
}
