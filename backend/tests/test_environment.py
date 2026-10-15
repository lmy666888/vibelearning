import os
import subprocess
from pathlib import Path
from app.environment import BACKEND_ENV_FILE, load_backend_environment
from app.services.ai.config import ProviderSettings
from app.services.ai.provider import OpenAICompatibleProvider
import asyncio
import httpx


def test_backend_env_path_is_absolute_and_independent_of_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert BACKEND_ENV_FILE.is_absolute()
    assert BACKEND_ENV_FILE == Path(__file__).resolve().parents[1] / ".env"


def test_dotenv_reads_provider_settings_without_overriding_process(tmp_path, monkeypatch):
    for name in ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_TIMEOUT_SECONDS"]:
        monkeypatch.delenv(name, raising=False)
    env = tmp_path / ".env"
    env.write_text("LLM_API_KEY=unit-test-credential\nLLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/\nLLM_MODEL=gemini-3.5-flash-lite\nLLM_TIMEOUT_SECONDS=30\n")
    assert load_backend_environment(env)
    settings = ProviderSettings.from_environment()
    assert settings.api_key == "unit-test-credential"
    assert settings.model == "gemini-3.5-flash-lite"
    assert settings.base_url == "https://generativelanguage.googleapis.com/v1beta/openai"
    assert settings.timeout == 30
    monkeypatch.setenv("LLM_MODEL", "explicit-process-model")
    load_backend_environment(env)
    assert ProviderSettings.from_environment().model == "explicit-process-model"
    assert settings.api_key not in repr(settings)


def test_missing_local_file_is_safe(tmp_path):
    assert load_backend_environment(tmp_path / "missing") is False


def test_environment_file_does_not_interpolate_other_secrets(tmp_path, monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.setenv("OTHER_SECRET", "must-not-expand")
    env = tmp_path / ".env"
    env.write_text('LLM_API_KEY=${OTHER_SECRET}\n')
    load_backend_environment(env)
    assert os.environ["LLM_API_KEY"] == "${OTHER_SECRET}"


def test_gemini_compatible_endpoint_payload_with_mock_transport():
    settings = ProviderSettings("unit-test-credential", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-3.5-flash-lite", 30)
    def handler(request):
        import json
        payload = json.loads(request.content)
        assert str(request.url) == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        assert payload["model"] == "gemini-3.5-flash-lite"
        assert payload["response_format"] == {"type": "json_object"}
        assert payload["max_completion_tokens"] == 1200
        return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"scope":"in_scope","result":{"answer":"Negative charge reverses force.", "key_concepts":["Electric force"], "related_equations":["F=qE"]}})}}]})
    result = asyncio.run(OpenAICompatibleProvider(settings, httpx.MockTransport(handler)).explain([]))
    assert result.answer == "Negative charge reverses force."


def test_backend_env_is_ignored_and_not_tracked():
    root = Path(__file__).resolve().parents[2]
    assert subprocess.run(["git", "check-ignore", "backend/.env"], cwd=root, capture_output=True).returncode == 0
    tracked = subprocess.run(["git", "ls-files", "--error-unmatch", "backend/.env"], cwd=root, capture_output=True)
    assert tracked.returncode != 0
