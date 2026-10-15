from pathlib import Path
from dotenv import load_dotenv

BACKEND_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"

def load_backend_environment(env_file: Path = BACKEND_ENV_FILE) -> bool:
    """Load only the backend-local file; explicit process variables take precedence."""
    return load_dotenv(dotenv_path=env_file, override=False, interpolate=False, encoding="utf-8")
