from starlette.responses import JSONResponse

class TutorBodyLimit:
    """Bound request bytes before JSON parsing, including chunked uploads."""
    def __init__(self, app, limit=65536):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] not in {"/api/ai/explain", "/api/ai/plan-action", "/api/ai/generate-lesson", "/api/ai/evaluate-observation"}:
            return await self.app(scope, receive, send)
        data = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            data.extend(message.get("body", b""))
            if len(data) > self.limit:
                return await JSONResponse({"detail": {"code": "request_too_large", "message": "Request body exceeds 64 KiB."}}, 413)(scope, receive, send)
            if not message.get("more_body", False):
                break
        delivered = False
        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(data), "more_body": False}
            return await receive()
        await self.app(scope, replay, send)
