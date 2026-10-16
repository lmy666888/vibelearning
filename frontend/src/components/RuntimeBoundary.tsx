import {Component,type ReactNode} from 'react';
import {reportClientError} from '../services/telemetry';
export class RuntimeBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){reportClientError('runtime');}
 render(){return this.state.failed?<main role="alert"><h1>实验界面需要恢复 / Experiment needs recovery</h1><p>请刷新重新加载已保存的实验设置；播放将暂停。Reload your saved setup; playback restores paused.</p><button onClick={()=>window.location.reload()}>重新加载 / Reload</button></main>:this.props.children;}
}
