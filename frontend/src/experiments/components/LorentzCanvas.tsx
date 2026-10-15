import {useStore} from 'zustand';
import {useEffect,useRef,useState} from 'react';
import type {Runtime} from '../runtime';
import type {LorentzState,LorentzParameters} from '../lorentz';
import type {Data} from '../contract';
export function LorentzCanvas({runtime}:{runtime:Runtime}){
 const error=useStore(runtime.store,s=>s.error);const ref=useRef<HTMLCanvasElement>(null),[vectors,setVectors]=useState(true);const visible=useRef(vectors);visible.current=vectors;
 useEffect(()=>{const canvas=ref.current!,ctx=canvas.getContext('2d')!;let frame=0,last:number|null=null,w=0,h=0,dpr=0;
 const resize=()=>{const r=canvas.getBoundingClientRect();w=r.width;h=r.height;dpr=window.devicePixelRatio||1;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 const screen=(x:number,y:number)=>({x:w/2+x*Math.min(w,h)/20,y:h/2-y*Math.min(w,h)/20});
 const arrow=(x:number,y:number,v:Data,color:string,length=38)=>{const vx=Number(v.x),vy=Number(v.y),m=Math.hypot(vx,vy);if(!m)return;const dx=vx/m*length,dy=-vy/m*length,a=Math.atan2(dy,dx);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.moveTo(x+dx-6*Math.cos(a-.5),y+dy-6*Math.sin(a-.5));ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-6*Math.cos(a+.5),y+dy-6*Math.sin(a+.5));ctx.stroke();};
 const draw=(now:number)=>{try{if((window.devicePixelRatio||1)!==dpr)resize();if(last!==null&&!document.hidden)runtime.advance((now-last)/1000);last=document.hidden?null:now;const s=runtime.store.getState(),p=s.parameters as unknown as LorentzParameters,state=s.state as unknown as LorentzState;ctx.clearRect(0,0,w,h);ctx.fillStyle='#101827';ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#26334a';ctx.lineWidth=.7;for(let i=-10;i<=10;i+=2){const a=screen(i,-10),b=screen(i,10),c=screen(-10,i),d=screen(10,i);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();}
 ctx.fillStyle='#526892';ctx.font='16px system-ui';for(let x=-8;x<=8;x+=4)for(let y=-8;y<=8;y+=4){const a=screen(x,y);if(p.magneticFieldZ!==0)ctx.fillText(p.magneticFieldZ>0?'⊙':'⊗',a.x,a.y);arrow(a.x,a.y,p.field,'#f0bc5c88',20);}
 ctx.strokeStyle='#c0a2ff';ctx.lineWidth=2;ctx.beginPath();s.trace.forEach((v,i)=>{const a=screen(v.x,v.y);if(!i)ctx.moveTo(a.x,a.y);else ctx.lineTo(a.x,a.y);});ctx.stroke();const a=screen(state.position.x,state.position.y);
 if(visible.current){arrow(a.x,a.y,state.velocity,'#62dcc9',46);arrow(a.x,a.y,s.observables.electric_force as Data,'#f6bd60',30);arrow(a.x,a.y,s.observables.magnetic_force as Data,'#ff72c4',38);arrow(a.x,a.y,s.observables.force as Data,'#60baff',54);}
 ctx.fillStyle=p.charge<0?'#ff6c80':'#5ca5ff';ctx.beginPath();ctx.arc(a.x,a.y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#bbc7de';ctx.font='12px system-ui';ctx.fillText(`Grid ±10 m · equal spatial scale · Bz = ${p.magneticFieldZ} T`,12,22);
 canvas.dataset.position=JSON.stringify(state.position);canvas.dataset.tracePoints=String(s.trace.length);frame=requestAnimationFrame(draw);
 }catch{runtime.store.setState({error:'Numerical limit reached. Adjust parameters or reset.'});runtime.pause();last=null;frame=requestAnimationFrame(draw);}};
 const visibility=()=>{last=null;};document.addEventListener('visibilitychange',visibility);frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);};
 },[runtime]);
 return <section className="panel"><div className="panel-heading"><h2>Lorentz Force · 2D</h2><label><input type="checkbox" checked={vectors} onChange={e=>setVectors(e.target.checked)}/> Show vectors</label></div>{error&&<p role="alert">{error}</p>}<div className="canvas-wrap"><canvas ref={ref} aria-label="Lorentz particle trajectory and force vectors"/></div><div className="legend">⊙ +Bz out of screen · ⊗ −Bz into screen · velocity: mint · electric force: amber · magnetic force: pink · total force: blue. Arrows indicate direction, normalized lengths.</div></section>;
}
