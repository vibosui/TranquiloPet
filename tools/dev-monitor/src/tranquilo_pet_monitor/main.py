from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from ipaddress import ip_address
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import router
from .config import Settings
from .live import LiveEventBus
from .repository import SQLiteMonitorRepository
from .service import MonitorService

PACKAGE_ROOT = Path(__file__).resolve().parent
WEB_ROOT = PACKAGE_ROOT / "web"
LOOPBACK_HOSTS = {"127.0.0.1", "::1", "testclient"}
PUBLIC_INGESTION_PATHS = {"/api/health", "/api/events"}
LOCAL_ONLY_PATH_PREFIXES = (
    "/api/dashboard",
    "/static",
    "/docs",
    "/redoc",
    "/openapi.json",
)


def _is_trusted_network_client(host: str) -> bool:
    if host in LOOPBACK_HOSTS:
        return True
    try:
        address = ip_address(host)
    except ValueError:
        return False
    return address.is_private or address.is_loopback


def create_app(settings: Settings | None = None) -> FastAPI:
    current_settings = settings or Settings.from_environment()
    repository = SQLiteMonitorRepository(current_settings.database_path)
    live_bus = LiveEventBus()
    monitor_service = MonitorService(repository, live_bus)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        repository.initialize()
        logging.getLogger("tranquilo_pet_monitor").info(
            "monitor_started dashboard=http://127.0.0.1:%s database=%s",
            current_settings.port,
            current_settings.database_path,
        )
        yield

    app = FastAPI(
        title="Tranquilo Pet Dev Monitor",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = current_settings
    app.state.repository = repository
    app.state.live_bus = live_bus
    app.state.monitor_service = monitor_service

    @app.middleware("http")
    async def local_security(request: Request, call_next):
        client_host = request.client.host if request.client else ""
        is_trusted_client = _is_trusted_network_client(client_host)
        is_public_ingestion = request.url.path in PUBLIC_INGESTION_PATHS

        if not is_trusted_client and not is_public_ingestion:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Monitor dashboard is available only on the local computer."},
            )

        is_local_only = request.url.path == "/" or request.url.path.startswith(
            LOCAL_ONLY_PATH_PREFIXES
        )
        if is_local_only and client_host not in LOOPBACK_HOSTS:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Dashboard available only on this computer."},
            )

        if request.method in {"POST", "PUT", "PATCH"}:
            content_length = request.headers.get("content-length")
            try:
                declared_length = int(content_length) if content_length else None
            except ValueError:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "Invalid Content-Length header."},
                )

            if declared_length is not None and declared_length > current_settings.max_request_bytes:
                return JSONResponse(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    content={"detail": "Request body is too large."},
                )

            body = await request.body()
            if len(body) > current_settings.max_request_bytes:
                return JSONResponse(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    content={"detail": "Request body is too large."},
                )

        return await call_next(request)

    @app.get("/", include_in_schema=False)
    def dashboard() -> FileResponse:
        return FileResponse(WEB_ROOT / "index.html")

    app.mount("/static", StaticFiles(directory=WEB_ROOT / "static"), name="static")
    app.include_router(router)
    return app
