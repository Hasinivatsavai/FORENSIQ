"""ASGI entrypoint. Run behind a same-origin TLS reverse proxy."""

import sqlite3
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader

from . import accounts, cases, evidence, workspace
from .db import connect, migrate


@asynccontextmanager
async def lifespan(_app):
    migrate()
    yield


app = FastAPI(
    title="FORENSIQ Evidence API",
    version="1.0.0",
    description="Use a signed-in browser and add X-Forensiq-Request: 1 to state-changing requests.",
    dependencies=[
        Depends(
            APIKeyHeader(
                name="X-Forensiq-Request",
                auto_error=False,
                description="Set this non-secret request marker to 1 to perform writes from Swagger.",
            )
        )
    ],
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    swagger_ui_oauth2_redirect_url="/api/docs/oauth2-redirect",
    lifespan=lifespan,
)
for router in (accounts.router, cases.router, evidence.router, workspace.router):
    app.include_router(router, prefix="/api")


class RequestBoundary:
    """Gate browser writes before dependencies parse multipart data. Also bound chunked uploads."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        method = scope["method"]
        if method not in ("GET", "HEAD", "OPTIONS"):
            # An attacker-controlled site cannot add a non-simple header without CORS permission.
            if headers.get(b"x-forensiq-request") != b"1" or headers.get(b"sec-fetch-site") == b"cross-site":
                return await JSONResponse({"detail": "A same-origin application request is required."}, 403)(
                    scope, receive, send
                )
        limit = (
            evidence.FILE_LIMIT + 128 * 1024
            if scope["path"] == "/api/evidence" and method == "POST"
            else 64 * 1024
        )
        length = headers.get(b"content-length", b"0")
        if not length.isdigit() or len(length) > 16 or int(length) > limit:
            return await JSONResponse({"detail": "Request is too large."}, 413)(scope, receive, send)
        received = 0

        async def receive_limited():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > limit:
                raise HTTPException(413, "Request is too large.")
            return message

        async def apply_response_headers(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message["headers"]) + [
                    (b"x-content-type-options", b"nosniff"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"x-frame-options", b"DENY"),
                ]
                if scope["path"].startswith("/api/"):
                    message["headers"].append((b"cache-control", b"no-store"))
            await send(message)

        await self.app(scope, receive_limited, apply_response_headers)


app.add_middleware(RequestBoundary)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    # FastAPI normally echoes invalid input; keep credentials and sensitive case text out of error responses.
    issues = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    return JSONResponse({"detail": issues}, 422)


@app.exception_handler(sqlite3.OperationalError)
async def database_unavailable(_request: Request, _exc: sqlite3.OperationalError):
    return JSONResponse({"detail": "The evidence database is temporarily unavailable."}, 503)


@app.get("/api/health", tags=["Operations"])
def health():
    with connect() as conn:
        conn.execute("SELECT 1 FROM schema_versions LIMIT 1")
    return {"status": "ok"}
