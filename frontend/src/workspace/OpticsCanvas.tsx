import type {Runtime} from '../experiments/runtime';
import {ScientificCanvas,viewTools,type ScientificView} from './ScientificCanvas';
import {opticalProfile,opticalDetections,type OpticalParameters} from '../experiments/optics';
import {workspaceStore} from './editor';
const view:ScientificView={label:'Double-slit optical profile and detections',legend:'Schematic apparatus (not to scale) · screen y in mm · intensity is physical model output · seeded probability, not quantum trajectories',visibilityLabels:['Apparatus','Wavefronts','Detections'],bounds:()=>({x:-10,y:-6,width:21,height:12}),draw:(ctx,s,c,size)=>{
 const p=s.parameters as unknown as OpticalParameters,{ys,values,probs}=opticalProfile(p),n=Number(s.query.events),events=opticalDetections(p,n),{to,line,text,dot}=viewTools(ctx,c,size),v=workspaceStore.getState().visible;
 if(v.fields){line({x:-5,y:-4},{x:-5,y:4},'#6d91b8',4);ctx.strokeStyle='#0b1421';for(const y of [-.65,.65])line({x:-5,y:y-.2},{x:-5,y:y+.2},'#75e3df',5);for(let i=0;i<6;i++){const x=-9+i*.5;line({x,y:-3},{x,y:3},'#406480');}text('Incident coherent wave',{x:-9,y:4.4});text(`d=${(p.slitSeparation*1e6).toFixed(1)} μm`,{x:-7,y:-4.8});text(`a=${(p.slitWidth*1e6).toFixed(1)} μm`,{x:-7,y:-5.4});line({x:1,y:-5},{x:1,y:5},'#aab9cd',3);text(`L=${p.screenDistance.toFixed(2)} m`,{x:-3,y:4.4});}
 if(v.vectors){ctx.strokeStyle='#375c73';for(const sy of [-.65,.65])for(let radius=.8;radius<5.5;radius+=.8){const center=to({x:-5,y:sy});ctx.beginPath();ctx.arc(center.x,center.y,radius*c.scale,-Math.PI/2,Math.PI/2);ctx.stroke();}}
 // Each screen stripe and curve point comes directly from I(y), not decorative paths.
 for(let i=0;i<ys.length;i++){const y=ys[i]/p.screenHalfRange*5,pt=to({x:1,y});ctx.fillStyle=`rgba(117,231,223,${Math.sqrt(values[i])})`;ctx.fillRect(pt.x-5,pt.y-1,10,2);}
 line({x:3,y:-5},{x:3,y:5});line({x:3,y:0},{x:9,y:0});ctx.strokeStyle='#77e0d6';ctx.lineWidth=1.6;ctx.beginPath();ys.forEach((y,i)=>{const pt=to({x:3+values[i]*5,y:y/p.screenHalfRange*5});if(i)ctx.lineTo(pt.x,pt.y);else ctx.moveTo(pt.x,pt.y);});ctx.stroke();text('I(y) / I(0)',{x:4,y:5.5});text(`±${(p.screenHalfRange*1000).toFixed(1)} mm`,{x:3,y:-5.7});
 if(p.detectionMode===1&&v.trail){for(let i=0;i<events.length;i++){const index=events[i];dot({x:1.3+((i*37)%71)/71,y:ys[index]/p.screenHalfRange*5},1.2,'#f4c875');}const hist=s.state.histogram as number[],max=Math.max(1,...hist);for(let i=0;i<hist.length;i++){const y=-5+(i+.5)/51*10,a=to({x:3,y}),b=to({x:3+hist[i]/max*5,y:y+10/51});ctx.fillStyle='#d6b76855';ctx.fillRect(a.x,b.y,Math.max(1,b.x-a.x),Math.max(1,a.y-b.y));}}
 text(`${n}/${p.detectionEvents} detections · seed ${p.seed}`,{x:-9,y:5.5},'#f4c875');text(`λ=${(p.wavelength*1e9).toFixed(0)} nm · Δy≈${(Number(s.observables.central_fringe_spacing)*1000).toFixed(2)} mm`,{x:-9,y:-5.9});
}};
export function OpticsCanvas({runtime}:{runtime:Runtime}){return <ScientificCanvas runtime={runtime} view={view}/>;}
