import {AITutorPanel} from '../components/ai/AITutorPanel';
import {ExperimentPresets} from '../components/simulation/ExperimentPresets';
import {ExperimentComparison} from '../components/simulation/ExperimentComparison';
import {GuidedLesson} from '../components/learning/GuidedLesson';
import {Header} from '../components/layout/Header';
import {SimulationCanvas} from '../components/simulation/SimulationCanvas';
import {ControlPanel} from '../components/simulation/ControlPanel';
import {SimulationInfo} from '../components/simulation/SimulationInfo';
export default function App(){return <><Header/><main><section className="intro"><div><span className="eyebrow">PHYSICS / INTERACTIVE LAB 01</span><h1>让抽象的电场，<em>变得可见。</em></h1><p>探索电荷、质量与电场的关系，用实时运动理解 F = qE。</p></div><span className="lesson-tag">电磁学 · 匀强电场</span></section><div className="workspace"><SimulationCanvas/><ControlPanel/></div><div className="day2-learning"><ExperimentPresets/><GuidedLesson/></div><SimulationInfo/><ExperimentComparison/><div className="learning-row"><section className="panel principle"><span className="eyebrow">THE PHYSICS BEHIND IT</span><h3>一个电场，两种方向。</h3><p>正电荷沿电场加速，负电荷逆电场加速。尝试翻转电荷符号，观察相同初速度下的轨迹变化。</p><div className="equations"><span>F = qE</span><span>a = qE / m</span><span>r(t) = r₀ + v₀t + ½at²</span></div></section><AITutorPanel/></div><footer>VibeLearning AI <span>解析模型 · SI 单位 · 为理解而构建</span></footer></main></>;}
