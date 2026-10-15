import { applyAction, physicsPreview, type Action, type PlanRequest, type Proposal } from '../services/actions';
export const doubleField: Action = { schema_version: 1, action: 'scale_parameter', target: 'field.y', factor: 2 };
export function proposalFor(request: PlanRequest, action: Action = doubleField): Proposal {
  const before = request.simulation_context.parameters, after = applyAction(before, action);
  return { status: 'proposal', action, explanation: 'Double the vertical electric field; review and confirm.', before, after,
    before_physics: physicsPreview(before), after_physics: physicsPreview(after),
    snapshot_id: request.snapshot_id, parameter_revision: request.parameter_revision, requires_confirmation: true };
}
