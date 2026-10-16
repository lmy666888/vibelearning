"""Load Docker secret files without logging their contents; validate before serving."""
import os,asyncio,sys
sys.path.insert(0,"/app/backend")
from pathlib import Path
for name in ['LLM_API_KEY','AI_REDIS_URL','AI_SESSION_SECRET','OPS_METRICS_TOKEN']:
    source=os.getenv(name+'_FILE')
    if source:os.environ[name]=Path(source).read_text().strip()
from app.readiness import checks
errors=asyncio.run(checks())
if errors:raise SystemExit('Startup refused: '+','.join(errors))
os.execv('/app/backend/.venv/bin/python',['python','-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8000','--no-proxy-headers','--no-access-log'])
