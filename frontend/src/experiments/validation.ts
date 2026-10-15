import type {Data,Manifest} from './contract';
export function record(v:unknown):Data{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Expected an object.');return v as Data;}
export function exact(v:Data,fields:string[]){if(Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))throw new Error('Unexpected fields.');}
export function get(p:Data,path:string):unknown{return path.split('.').reduce<unknown>((v,k)=>record(v)[k],p);}
export function put(p:Data,path:string,v:number){const parts=path.split('.');let node=p;for(const k of parts.slice(0,-1))node=record(node[k]);node[parts.at(-1)!]=v;}
export function bounded(p:Data,m:Manifest){for(const c of m.parameters){const v=get(p,c.target);if(typeof v!=='number'||!Number.isFinite(v)||v<c.min*c.scale||v>c.max*c.scale)throw new Error(`${c.target} outside supported SI bounds.`);}}
export function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export function close(a:unknown,b:unknown):boolean{if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-15,Math.abs(b)*1e-8);if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=record(a),y=record(b);return Object.keys(x).length===Object.keys(y).length&&Object.keys(y).every(k=>Object.hasOwn(x,k)&&close(x[k],y[k]));}return a===b;}
/** Non-security correlation hash: sorted keys and exact IEEE-754 input bits, identical across runtimes. */
export function fingerprint(value:unknown):string{
 const normalize=(v:unknown):unknown=>{if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('Nonfinite snapshot.');if(v===0)return '0';const bytes=new ArrayBuffer(8),view=new DataView(bytes);view.setFloat64(0,v,false);return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,normalize(x)]));return v;};
 const bytes=new TextEncoder().encode(JSON.stringify(normalize(value)));let hash=2166136261;for(const b of bytes)hash=Math.imul(hash^b,16777619)>>>0;return `fnv1a-${hash.toString(16).padStart(8,'0')}`;
}
