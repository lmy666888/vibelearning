from fastapi import APIRouter
from pydantic import BaseModel
from typing import Literal
router = APIRouter()
class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["vibelearning-api"] = "vibelearning-api"
@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()
