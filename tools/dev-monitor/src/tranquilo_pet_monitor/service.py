from __future__ import annotations

import json
import logging

from .live import LiveEventBus
from .repository import SQLiteMonitorRepository
from .schemas import (
    DashboardEvent,
    DashboardMetrics,
    DashboardSnapshot,
    UsageEventCreate,
    UsageEventCreated,
)

logger = logging.getLogger("tranquilo_pet_monitor.activity")


class MonitorService:
    def __init__(self, repository: SQLiteMonitorRepository, live_bus: LiveEventBus):
        self._repository = repository
        self._live_bus = live_bus

    def record_event(self, event: UsageEventCreate) -> UsageEventCreated:
        created = self._repository.insert_event(event)
        logger.info(
            "event session=%s platform=%s screen=%s name=%s",
            event.session_id,
            event.platform,
            event.screen,
            event.event_name,
        )
        self._publish_update("event", str(created.id))
        return UsageEventCreated(id=int(created.id), received_at=created.created_at)

    def dashboard_snapshot(self) -> DashboardSnapshot:
        metrics = DashboardMetrics.model_validate(self._repository.dashboard_metrics())
        events = [DashboardEvent.model_validate(event) for event in self._repository.recent_events()]
        return DashboardSnapshot(metrics=metrics, events=events)

    def _publish_update(self, entity: str, entity_id: str) -> None:
        self._live_bus.publish(json.dumps({"entity": entity, "id": entity_id}))
