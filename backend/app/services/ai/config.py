from dataclasses import dataclass, field
import math
import os
from urllib.parse import urlsplit

class ConfigurationError(ValueError):
    pass

@dataclass(frozen=True)
class ProviderSettings:
    api_key: str = field(repr=False)
    base_url: str
    model: str
    timeout: float = 20.0

    @classmethod
    def from_environment(cls):
        key = os.getenv("LLM_API_KEY", "").strip()
        base = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
        model = os.getenv("LLM_MODEL", "").strip()
        try:
            timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "20"))
            url = urlsplit(base)
            local = url.hostname in {"localhost", "127.0.0.1", "::1"}
            if not key or not model or not url.hostname or url.username or url.password or url.query or url.fragment:
                raise ValueError()
            if url.scheme != "https" and not (url.scheme == "http" and local):
                raise ValueError()
            if not math.isfinite(timeout) or not 1 <= timeout <= 120:
                raise ValueError()
        except ValueError as exc:
            raise ConfigurationError("AI Tutor is not configured. Configure the backend provider environment.") from exc
        return cls(key, base, model, timeout)
