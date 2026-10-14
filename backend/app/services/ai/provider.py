import json
from typing import Protocol
import httpx
from pydantic import ValidationError
from app.schemas.ai import Explanation
from app.services.ai.config import ProviderSettings

class ProviderError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message

class TutorProvider(Protocol):
    async def explain(self, messages: list[dict[str, str]]) -> Explanation: ...

class OpenAICompatibleProvider:
    def __init__(self, settings: ProviderSettings, transport: httpx.AsyncBaseTransport | None = None):
        self.settings, self.transport = settings, transport

    async def explain(self, messages: list[dict[str, str]]) -> Explanation:
        settings = self.settings
        try:
            async with httpx.AsyncClient(timeout=settings.timeout, transport=self.transport,
                                         follow_redirects=False, trust_env=False) as client:
                async with client.stream("POST", settings.base_url + "/chat/completions",
                    headers={"Authorization": "Bearer " + settings.api_key},
                    json={"model": settings.model, "messages": messages,
                          "response_format": {"type": "json_object"}, "max_completion_tokens": 1500}) as response:
                    if response.status_code < 200 or response.status_code >= 300:
                        raise ProviderError(502, "provider_error", "The AI provider could not complete the request. Try again later.")
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk)
                        if len(body) > 32768:
                            raise ValueError("Oversized upstream response")
            envelope = json.loads(body)
            choice = envelope["choices"][0]
            if choice.get("finish_reason") != "stop":
                raise ValueError("Incomplete or unsupported completion")
            content = choice["message"]["content"]
            if not isinstance(content, str) or settings.api_key in content:
                raise ValueError("Invalid completion content")
            return Explanation.model_validate_json(content)
        except httpx.TimeoutException as exc:
            raise ProviderError(504, "provider_timeout", "The AI provider timed out. Please retry.") from exc
        except httpx.RequestError as exc:
            raise ProviderError(503, "provider_unavailable", "The AI provider is temporarily unavailable.") from exc
        except (ValueError, TypeError, KeyError, IndexError, ValidationError) as exc:
            raise ProviderError(502, "invalid_provider_response", "The AI provider returned an invalid explanation. Please retry.") from exc
