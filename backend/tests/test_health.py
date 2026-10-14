import asyncio
import httpx
from app.main import app

def request(method, path, **kwargs):
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.request(method, path, **kwargs)
    return asyncio.run(run())

def test_health():
    response = request("GET", "/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "vibelearning-api"}

def test_cors():
    response = request("OPTIONS", "/api/health", headers={"Origin":"http://localhost:5173", "Access-Control-Request-Method":"GET"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

def test_not_found():
    assert request("GET", "/api/missing").status_code == 404
