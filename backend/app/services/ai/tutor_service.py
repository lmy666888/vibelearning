import asyncio
from app.schemas.ai import ExplainRequest, Explanation
from app.services.ai.config import ProviderSettings
from app.services.ai.provider import OpenAICompatibleProvider, ProviderError, TutorProvider
from app.services.ai.prompt_builder import build_messages, SYSTEM_PROMPT
from app.services.physics.context_validator import verify_context

class TutorService:
    """Fail-fast, per-process admission control. No unbounded paid-call queue or retries."""
    def __init__(self, max_concurrent: int = 2):
        self._slots = asyncio.Semaphore(max_concurrent)

    async def explain(self, request: ExplainRequest, provider: TutorProvider | None = None,
                      settings: ProviderSettings | None = None) -> Explanation:
        context = verify_context(request.simulation_context)
        settings = settings or ProviderSettings.from_environment()
        if self._slots.locked():
            raise ProviderError(429, "tutor_busy", "AI Tutor is busy. Retry in a moment.")
        async with self._slots:
            selected = provider or OpenAICompatibleProvider(settings)
            try:
                result = await asyncio.wait_for(selected.explain(build_messages(request.question, context)), settings.timeout)
                validated = Explanation.model_validate(result)
                if settings.api_key in validated.model_dump_json() or SYSTEM_PROMPT in validated.answer:
                    raise ProviderError(502, "invalid_provider_response", "The AI provider returned an invalid explanation.")
                return validated
            except TimeoutError as exc:
                raise ProviderError(504, "provider_timeout", "The AI provider timed out. Please retry.") from exc
