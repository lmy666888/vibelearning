import asyncio
from app.schemas.ai import ExplainRequest, Explanation
from app.services.ai.config import ProviderSettings
from app.services.ai.provider import OpenAICompatibleProvider, ProviderError, TutorProvider
from app.services.ai.prompt_builder import build_messages, SYSTEM_PROMPT
from app.services.physics.context_validator import verify_context
from app.services.ai.language import language_rule, ensure_language

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
                messages = build_messages(request.question, context)
                if request.preferred_language:
                    messages[0]['content'] += language_rule(request.preferred_language)
                result = await asyncio.wait_for(selected.explain(messages), settings.timeout)
                validated = Explanation.model_validate(result)
                if settings.api_key in validated.model_dump_json() or SYSTEM_PROMPT in validated.answer:
                    raise ProviderError(502, "invalid_provider_response", "The AI provider returned an invalid explanation.")
                if request.preferred_language:
                    ensure_language([validated.answer, *validated.key_concepts], request.preferred_language)
                return validated
            except TimeoutError as exc:
                raise ProviderError(504, "provider_timeout", "The AI provider timed out. Please retry.") from exc

    async def plan_action(self, request, provider=None, settings=None):
        from app.services.ai.action_planner import plan_action
        return await plan_action(self, request, provider, settings)

    async def generate_lesson(self, request, provider=None, settings=None):
        from app.services.ai.learning_service import generate_lesson
        return await generate_lesson(self, request, provider, settings)

    async def evaluate_observation(self, request, provider=None, settings=None):
        from app.services.ai.learning_service import evaluate_observation
        return await evaluate_observation(self, request, provider, settings)
