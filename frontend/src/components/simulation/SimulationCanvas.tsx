import {useEffect,useRef,useState} from 'react';
import {useSimulationStore} from '../../stores/simulationStore';
import {calculateParticleState,calculateTrajectory} from '../../simulations/physics/uniform-electric-field/physics';
import {physicalToScreen,inViewport} from '../../simulations/core/coordinates';
export function SimulationCanvas(){
 const ref=useRef<HTMLCanvasElement>(null);const [outside,setOutside]=useState(false);
 useEffect(()=>{
 const canvas=ref.current!;const ctx=canvas.getContext('2d')!;let width=0,height=0,renderDpr=0,last:number|null=null,frame=0,wasOutside=false;
 function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=window.devicePixelRatio||1;renderDpr=dpr;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 let resolutionQuery:MediaQueryList|null=null;
 function watchResolution(){
   resolutionQuery?.removeEventListener('change',onResolutionChange);
   resolutionQuery=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);
   resolutionQuery.addEventListener('change',onResolutionChange);
 }
 function onResolutionChange(){resize();watchResolution();}
 watchResolution();
 window.addEventListener('resize',resize);
 function arrow(x:number,y:number,dx:number,dy:number,color:string){if(Math.hypot(dx,dy)<0.01)return;ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);const a=Math.atan2(dy,dx);ctx.moveTo(x+dx-6*Math.cos(a-0.5),y+dy-6*Math.sin(a-0.5));ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-6*Math.cos(a+0.5),y+dy-6*Math.sin(a+0.5));ctx.stroke();}
 function draw(now:number){
 // Some browsers do not emit a resolution event for emulated or cross-display DPR changes.
 if((window.devicePixelRatio||1)!==renderDpr){resize();watchResolution();}
 if(!document.hidden&&last!==null)useSimulationStore.getState().advance((now-last)/1000);last=document.hidden?null:now;
 const s=useSimulationStore.getState(),p=s.parameters,particle=calculateParticleState(p,s.time);ctx.clearRect(0,0,width,height);
 const screen=(x:number,y:number)=>physicalToScreen({x,y},width,height);
 ctx.save();const lo=screen(-10,25),hi=screen(50,-15);ctx.beginPath();ctx.rect(lo.x,lo.y,hi.x-lo.x,hi.y-lo.y);ctx.clip();
 ctx.strokeStyle='#233147';ctx.lineWidth=0.6;
 for(let x=-10;x<=50;x+=5){const a=screen(x,-15),b=screen(x,25);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 for(let y=-15;y<=25;y+=5){const a=screen(-10,y),b=screen(50,y);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 const magnitude=Math.hypot(p.field.x,p.field.y);
 if(magnitude>0)for(let x=-7;x<=48;x+=5)for(let y=-12;y<=23;y+=5){const a=screen(x,y);arrow(a.x,a.y,22*p.field.x/magnitude,-22*p.field.y/magnitude,'#52689288');}
 const origin=screen(0,0),xr=screen(49,0),yt=screen(0,24);arrow(screen(-10,0).x,origin.y,xr.x-screen(-10,0).x,0,'#75869b');arrow(origin.x,screen(0,-15).y,0,yt.y-screen(0,-15).y,'#75869b');
 ctx.fillStyle='#9aabc0';ctx.font='11px system-ui';ctx.fillText('x (m)',xr.x-34,origin.y+18);ctx.fillText('y (m)',yt.x+10,yt.y+12);ctx.fillText('0',origin.x-12,origin.y+16);
 for(let x=10;x<=40;x+=10){const a=screen(x,0);ctx.fillText(String(x),a.x-6,a.y+16);}for(let y=-10;y<=20;y+=10){if(y){const a=screen(0,y);ctx.fillText(String(y),a.x+6,a.y+4);}}
 const points=calculateTrajectory(p,s.time);ctx.beginPath();points.forEach((point,i)=>{const a=physicalToScreen(point,width,height);if(i===0)ctx.moveTo(a.x,a.y);else ctx.lineTo(a.x,a.y);});ctx.strokeStyle='#c0a2ff';ctx.lineWidth=2.4;ctx.stroke();
 const a=physicalToScreen(particle.position,width,height),color=p.charge>0?'#5ca5ff':p.charge<0?'#ff6c80':'#a1aab8';const speed=Math.hypot(particle.velocity.x,particle.velocity.y);
 if(speed>0)arrow(a.x,a.y,36*particle.velocity.x/speed,-36*particle.velocity.y/speed,'#62dcc9');
 ctx.shadowColor=color;ctx.shadowBlur=20;ctx.fillStyle=color;ctx.beginPath();ctx.arc(a.x,a.y,9,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#091325';ctx.font='bold 13px system-ui';ctx.fillText(p.charge>0?'+':p.charge<0?'−':'0',a.x-4,a.y+4);ctx.restore();
 const out=!inViewport(particle.position);if(out!==wasOutside){wasOutside=out;setOutside(out);}frame=requestAnimationFrame(draw);
 }
 const visibility=()=>{last=null;};document.addEventListener('visibilitychange',visibility);frame=requestAnimationFrame(draw);
 return()=>{cancelAnimationFrame(frame);observer.disconnect();
 resolutionQuery?.removeEventListener('change',onResolutionChange);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 return <section className="panel canvas-panel"><div className="panel-heading"><div><span className="eyebrow">LIVE SIMULATION</span><h2>二维匀强电场</h2></div><span className="tag">Canvas 2D · SI units</span></div><div className="canvas-wrap"><canvas ref={ref} aria-label="匀强电场、带电粒子和运动轨迹"/>{outside&&<div className="offscreen" role="status">粒子已离开视野 · 物理计算继续进行</div>}</div><div className="legend"><span><i className="dot blue"/>粒子</span><span><i className="line purple"/>运动轨迹</span><span><i className="line mint"/>速度方向</span><span className="viewport">视野 x ∈ [−10, 50] m · y ∈ [−15, 25] m</span></div></section>;
}
