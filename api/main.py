"""FastAPI application entry point for Skåne Trails API."""

import logging
import os
from collections.abc import Awaitable, Callable

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routers import foraging, hike_groups, places, trails
from api.storage.validation import InvalidDocumentIdError

logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(
    title="Skåne Trails API",
    description="API for hiking trails, foraging spots, and points of interest in Skåne, Sweden",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,  # type: ignore[arg-type]
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(trails.router, prefix="/api/v1")
app.include_router(foraging.router, prefix="/api/v1")
app.include_router(places.router, prefix="/api/v1")
app.include_router(hike_groups.router, prefix="/api/v1")


@app.exception_handler(InvalidDocumentIdError)
async def invalid_document_id_handler(request: Request, exc: InvalidDocumentIdError) -> JSONResponse:
    """Return 400 for invalid Firestore document IDs."""
    logger.warning("Invalid document ID on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:  # noqa: ARG001
    """Catch unhandled exceptions and return a generic error response."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.middleware("http")
async def security_headers(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Add standard security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for Cloud Run."""
    return {"status": "healthy"}


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with API information."""
    return {"name": "Skåne Trails API", "version": "0.1.0", "docs": "/api/docs"}
