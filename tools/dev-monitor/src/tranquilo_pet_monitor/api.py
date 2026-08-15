from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request, status
from fastapi.responses import StreamingResponse

from .schemas import (
    DashboardSnapshot,
    UsageEventCreate,
    UsageEventCreated,
)
from .service import MonitorService

router = APIRouter()


def _service(request: Request) -> MonitorService:
    return request.app.state.monitor_service


@router.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "tranquilo-pet-dev-monitor", "version": "0.1.0"}


@router.post(
    "/api/events",
    response_model=UsageEventCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_event(payload: UsageEventCreate, request: Request) -> UsageEventCreated:
    return _service(request).record_event(payload)


@router.get("/api/dashboard/snapshot", response_model=DashboardSnapshot)
def dashboard_snapshot(request: Request) -> DashboardSnapshot:
    return _service(request).dashboard_snapshot()


@router.get("/api/dashboard/stream")
async def dashboard_stream(request: Request) -> StreamingResponse:
    live_bus = request.app.state.live_bus

    async def stream() -> AsyncIterator[str]:
        async with live_bus.subscribe() as queue:
            yield f"event: ready\ndata: {json.dumps({'connected': True})}\n\n"
            while True:
                if await request.is_disconnected():
                    return
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"event: update\ndata: {message}\n\n"
                except TimeoutError:
                    yield ": keep-alive\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
