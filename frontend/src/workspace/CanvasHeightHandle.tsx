import {useRef} from 'react';
import {useStore} from 'zustand';
import {workspaceStore} from './editor';
/** Portable height affordance; does not depend on the browser's native CSS resizer. */
export function CanvasHeightHandle(){
 const height=useStore(workspaceStore,s=>s.height),start=useRef<{y:number;height:number}|null>(null);
 const resize=(value:number)=>workspaceStore.setState({height:Math.max(360,Math.min(900,Math.round(value)))});
 return <div className="lab-height-handle" role="separator" aria-label="Resize canvas height" aria-orientation="horizontal" aria-valuemin={360} aria-valuemax={900} aria-valuenow={height} tabIndex={0} onPointerDown={e=>{e.preventDefault();e.stopPropagation();start.current={y:e.clientY,height};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(start.current)resize(start.current.height+e.clientY-start.current.y);}} onPointerUp={e=>{start.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>start.current=null} onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();resize(e.key==='Home'?360:e.key==='End'?900:height+(e.key==='ArrowDown'?10:-10));}}}>↕</div>;
}
