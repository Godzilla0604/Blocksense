"""BlockSense API — FastAPI application entry point.

Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import config
from api.routes import ApiError, router
from core.cache import state
from core.pipeline import run_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Precompute everything once, in the background, so /api/status can
    # report each real stage to the frontend while it runs.
    threading.Thread(target=run_pipeline, args=(state,), daemon=True).start()
    yield


app = FastAPI(
    title="BlockSense API",
    version="1.0.0",
    description="Bitcoin transaction anomaly and risk-signal API (SIH 2026 PS 26146). "
                "Surfaces risk signals for investigation; never asserts guilt or identity.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
    expose_headers=["X-BlockSense-Environment"],
)


def _err(code: int, message: str, details: str = "") -> JSONResponse:
    return JSONResponse(status_code=code,
                        content={"error": {"code": code, "message": message, "details": details}})


@app.exception_handler(ApiError)
async def api_error(_: Request, exc: ApiError):
    return _err(exc.code, exc.message, exc.details)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(p) for p in first.get("loc", []))
    return _err(400, "Invalid request parameters", f"{loc}: {first.get('msg', '')}")


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return _err(exc.status_code, "Not found" if exc.status_code == 404 else "Request failed",
                str(exc.detail))


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    logging.getLogger("blocksense").exception("Unhandled error")
    return _err(500, "Internal server error", type(exc).__name__)


app.include_router(router)


@app.get("/")
def root():
    return {"name": "BlockSense API", "docs": "/docs", "status": "/api/status"}
