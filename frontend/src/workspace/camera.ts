export interface Camera {x:number;y:number;scale:number}
export interface Size {width:number;height:number}
export const defaultCamera:Camera={x:0,y:0,scale:30};
export const worldToScreen=(p:{x:number;y:number},c:Camera,s:Size)=>({x:s.width/2+(p.x-c.x)*c.scale,y:s.height/2-(p.y-c.y)*c.scale});
export const screenToWorld=(p:{x:number;y:number},c:Camera,s:Size)=>({x:c.x+(p.x-s.width/2)/c.scale,y:c.y-(p.y-s.height/2)/c.scale});
export function validCamera(c:Camera){if(!c||![c.x,c.y,c.scale].every(Number.isFinite)||Math.abs(c.x)>10000||Math.abs(c.y)>10000||c.scale<.5||c.scale>1000)throw new Error('Invalid viewport.');return {...c};}
export function zoomAt(c:Camera,anchor:{x:number;y:number},s:Size,factor:number){const before=screenToWorld(anchor,c,s),scale=Math.max(.5,Math.min(1000,c.scale*factor)),after=screenToWorld(anchor,{...c,scale},s);return validCamera({x:c.x+before.x-after.x,y:c.y+before.y-after.y,scale});}
export function fitBounds(b:{x:number;y:number;width:number;height:number},s:Size):Camera{return validCamera({x:b.x+b.width/2,y:b.y+b.height/2,scale:Math.max(.5,Math.min(1000,Math.min((s.width-60)/Math.max(.1,b.width),(s.height-60)/Math.max(.1,b.height))))});}
