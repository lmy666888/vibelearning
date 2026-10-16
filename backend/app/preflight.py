"""Deployment entrypoint gate; reports only stable readiness codes."""
import asyncio
from app.environment import load_backend_environment
from app.readiness import checks
if __name__=='__main__':
    load_backend_environment();errors=asyncio.run(checks())
    print('Startup validation: '+(','.join(errors) if errors else 'ready'))
    raise SystemExit(1 if errors else 0)
