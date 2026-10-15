import { physicsPreview } from '../../services/actions';
import type { SimulationParameters } from '../../simulations/physics/uniform-electric-field/types';
const number=(v:number)=>v===0?'0':`${v>0?'+':'−'}${Math.abs(v).toPrecision(4)}`;
const vector=(v:{x:number;y:number})=>`(${number(v.x)}, ${number(v.y)})`;
export function PhysicsPreviewTable({before,after}:{before:SimulationParameters;after:SimulationParameters}){
  const values=(p:SimulationParameters)=>{const physics=physicsPreview(p);return [number(p.charge),number(p.mass),vector(p.field),vector(physics.force),vector(physics.acceleration),number(physics.acceleration_magnitude),vector(p.initialVelocity),vector(p.initialPosition)];};
  return <div className="proposal-table" tabIndex={0} aria-label="Physics preview comparison"><table><thead><tr><th>Quantity (SI)</th><th>Before</th><th>After confirmation</th></tr></thead><tbody>
    {['Charge q (C)','Mass m (kg)','Electric field E (N/C)','Electric force F (N)','Acceleration a (m/s²)','Acceleration magnitude |a| (m/s²)','Initial velocity v₀ (m/s)','Initial position r₀ (m)'].map((label,i)=><tr key={label}><th scope="row">{label}</th><td>{values(before)[i]}</td><td>{values(after)[i]}</td></tr>)}
  </tbody></table></div>;
}
