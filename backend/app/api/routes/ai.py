from fastapi import APIRouter, Depends, HTTPException, Request
from app.schemas.ai import ExplainRequest, Explanation
from app.schemas.actions import PlanRequest, PlanResult
from app.services.physics.actions import InvalidAction
from app.services.ai.config import ConfigurationError
from app.services.ai.provider import ProviderError
from app.services.ai.tutor_service import TutorService
from app.services.physics.context_validator import InvalidPhysicsContext

router = APIRouter()
service = TutorService()
def get_tutor_service() -> TutorService:
    return service

def check_access(request: Request):
    # Local-only MVP; this is not a substitute for authentication behind a public reverse proxy.
    if request.client is None or request.client.host not in {"127.0.0.1", "::1", "localhost"}:
        raise HTTPException(403, detail={"code": "local_only", "message": "AI Tutor is available only on the local development server."})
    origin = request.headers.get("origin")
    if origin and origin not in request.app.state.frontend_origins:
        raise HTTPException(403, detail={"code": "origin_denied", "message": "Frontend origin is not allowed."})

async def complete(call):
    try:
        return await call
    except InvalidPhysicsContext as exc:
        raise HTTPException(422, detail={"code": "inconsistent_physics", "message": str(exc)}) from None
    except InvalidAction as exc:
        raise HTTPException(422, detail={"code": "invalid_action", "message": str(exc)}) from None
    except ConfigurationError:
        raise HTTPException(503, detail={"code": "tutor_not_configured", "message": "AI Tutor is not configured on this backend."}) from None
    except ProviderError as exc:
        raise HTTPException(exc.status, detail={"code": exc.code, "message": exc.message},
                            headers={"Retry-After": "1"} if exc.status == 429 else None) from None
    except Exception:
        # Never echo provider exceptions, upstream bodies, prompts, questions, or credentials.
        raise HTTPException(500, detail={"code": "tutor_error", "message": "AI Tutor could not complete the request."}) from None

@router.post("/ai/explain", response_model=Explanation)
async def explain(body: ExplainRequest, request: Request, tutor: TutorService = Depends(get_tutor_service)) -> Explanation:
    check_access(request)
    return await complete(tutor.explain(body))

@router.post("/ai/plan-action", response_model=PlanResult)
async def plan_action(body: PlanRequest, request: Request, tutor: TutorService = Depends(get_tutor_service)) -> PlanResult:
    check_access(request)
    return await complete(tutor.plan_action(body))
