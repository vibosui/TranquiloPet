from __future__ import annotations

import json
import logging

from .live import LiveEventBus
from .repository import SQLiteMonitorRepository
from .schemas import (
    DashboardEvent,
    DashboardMetrics,
    DashboardSnapshot,
    DashboardTutor,
    TutorProfileCreate,
    TutorProfileCreated,
    UsageEventCreate,
    UsageEventCreated,
)

logger = logging.getLogger("tranquilo_pet_monitor.activity")


def _mask_email(email: str) -> str:
    local, domain = email.split("@", maxsplit=1)
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}*******@{domain}"


def _mask_phone(phone: str) -> str:
    return f"(**) *****-{phone[-4:]}"


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

    def create_tutor(self, profile: TutorProfileCreate) -> TutorProfileCreated:
        created = self._repository.insert_tutor(profile)
        logger.info("tutor_created profile_id=%s session=%s", created.id, profile.session_id)
        self._publish_update("tutor", str(created.id))
        return TutorProfileCreated(id=str(created.id), created_at=created.created_at)

    def dashboard_snapshot(self) -> DashboardSnapshot:
        metrics = DashboardMetrics.model_validate(self._repository.dashboard_metrics())
        events = [DashboardEvent.model_validate(event) for event in self._repository.recent_events()]
        tutors = [
            DashboardTutor(
                id=tutor["id"],
                full_name=tutor["full_name"],
                masked_email=_mask_email(tutor["email"]),
                masked_phone=_mask_phone(tutor["phone"]),
                city=tutor["city"],
                state=tutor["state"],
                created_at=tutor["created_at"],
            )
            for tutor in self._repository.recent_tutors()
        ]
        return DashboardSnapshot(metrics=metrics, events=events, tutors=tutors)

    def _publish_update(self, entity: str, entity_id: str) -> None:
        self._live_bus.publish(json.dumps({"entity": entity, "id": entity_id}))
