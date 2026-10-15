import math
from pydantic import ValidationError
from app.schemas.ai import SimulationContext, ParticleState, Vector2

class InvalidPhysicsContext(ValueError):
    pass

def canonical_state(context: SimulationContext) -> ParticleState:
    """Analytical SI equations matching the frontend; no integration or UI assumptions."""
    p, t = context.parameters, context.time
    try:
        force = Vector2(x=p.charge * p.field.x, y=p.charge * p.field.y)
        acceleration = Vector2(x=force.x / p.mass, y=force.y / p.mass)
        velocity = Vector2(x=p.initialVelocity.x + acceleration.x * t,
                           y=p.initialVelocity.y + acceleration.y * t)
        position = Vector2(x=p.initialPosition.x + p.initialVelocity.x * t + 0.5 * acceleration.x * t * t,
                           y=p.initialPosition.y + p.initialVelocity.y * t + 0.5 * acceleration.y * t * t)
        return ParticleState(time=t, force=force, acceleration=acceleration, velocity=velocity, position=position)
    except (ArithmeticError, ValidationError) as exc:
        raise InvalidPhysicsContext("Physical calculation exceeds the finite numeric range") from exc

def verify_context(context: SimulationContext) -> SimulationContext:
    state = canonical_state(context)
    expected = {"particleState": state.model_dump(), "force": state.force.model_dump(),
                "acceleration": state.acceleration.model_dump()}
    actual = {"particleState": context.particleState.model_dump(), "force": context.force.model_dump(),
              "acceleration": context.acceleration.model_dump()}
    def compare(before, after, path):
        for key, value in before.items():
            label = f"{path}.{key}" if path else key
            if isinstance(value, dict):
                compare(value, after[key], label)
            elif not math.isclose(value, after[key], rel_tol=1e-8, abs_tol=1e-15):
                raise InvalidPhysicsContext(f"Inconsistent derived physics at {label}")
    compare(expected, actual, "")
    # The provider always receives recalculated values, even for differences within tolerance.
    return context.model_copy(update={"particleState": state, "force": state.force, "acceleration": state.acceleration})
