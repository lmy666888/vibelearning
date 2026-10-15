import {createStore} from 'zustand/vanilla';
import type {Runtime} from '../experiments/runtime';
import type {Data} from '../experiments/contract';
import type {Region} from '../experiments/spatial';
import {defaultCamera,validCamera,type Camera} from './camera';
export const workspaceStore=createStore<{camera:Camera;height:number;selected:string|null;visible:{fields:boolean;vectors:boolean;trail:boolean};panel:'parameters'|'canvas'|'ai';setCamera:(c:Camera)=>void}>(set=>({camera:defaultCamera,height:560,selected:null,visible:{fields:true,vectors:true,trail:true},panel:'canvas',setCamera:camera=>set({camera:validCamera(camera)})}));
export function makeEditor(runtime:Runtime){let undo:Data[]=[],redo:Data[]=[],ownRevision=runtime.store.getState().revision;
 const sync=()=>{if(runtime.store.getState().revision!==ownRevision){undo=[];redo=[];ownRevision=runtime.store.getState().revision;}};
 const commit=(p:Data)=>{sync();const old=structuredClone(runtime.store.getState().parameters);runtime.commit(p,runtime.context());undo=[...undo,old].slice(-40);redo=[];ownRevision=runtime.store.getState().revision;};
 const travel=(back:boolean)=>{sync();const source=back?undo:redo,target=back?redo:undo;if(!source.length)return;const p=source.at(-1)!;const old=structuredClone(runtime.store.getState().parameters);runtime.commit(p,runtime.context());source.pop();target.push(old);ownRevision=runtime.store.getState().revision;};
 return {commit,undo:()=>travel(true),redo:()=>travel(false),canUndo:()=>{sync();return !!undo.length;},canRedo:()=>{sync();return !!redo.length;}};
}
export type Editor=ReturnType<typeof makeEditor>;
export function newRegion(regions:Region[]):Region{let n=1;while(regions.some(r=>r.id===`zone-${n}`))n++;return {schema_version:1,id:`zone-${n}`,name:`Zone ${n}`,geometry:{type:'rectangle',x:0,y:-3,width:3,height:6},electric_field:{x:0,y:100},magnetic_field:{z:0},enabled:true,color:'cyan'};}
export function snapRegion(r:Region,others:Region[],tolerance=.15):Region{const next=structuredClone(r),g=next.geometry;for(const axis of ['x','y'] as const){const size=axis==='x'?'width':'height';let best=tolerance,offset=0;for(const other of others){if(other.id===r.id)continue;for(const a of [g[axis],g[axis]+g[size]])for(const b of [other.geometry[axis],other.geometry[axis]+other.geometry[size]])if(Math.abs(b-a)<best){best=Math.abs(b-a);offset=b-a;}}g[axis]+=offset;}return next;}
