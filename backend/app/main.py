import os
from app.environment import load_backend_environment

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes.health import router as health_router
from app.api.routes.ai import router as ai_router
from app.experiments.ai import router as experiment_ai_router
from app.request_limits import TutorBodyLimit
from app.governance.middleware import AIGovernanceMiddleware

load_backend_environment()

app = FastAPI(title="VibeLearning API", version="0.3.0")
origins = [value.strip() for value in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if value.strip()]
if "*" in origins:
    raise RuntimeError("Configure explicit frontend origins; wildcard CORS is not permitted")
app.state.frontend_origins = origins
app.add_middleware(TutorBodyLimit)
app.add_middleware(AIGovernanceMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, expose_headers=["Retry-After","X-AI-Remaining-Daily","X-AI-Remaining-Minute"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
app.include_router(health_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(experiment_ai_router,prefix="/api")

@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Do not echo request bodies or Pydantic input/context objects.
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]})
