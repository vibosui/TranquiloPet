from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator


SessionId = Annotated[str, Field(min_length=8, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")]
EventName = Literal[
    "app_opened",
    "interaction_test_pressed",
    "tutor_registration_opened",
    "tutor_registration_submit_started",
    "tutor_registration_validation_failed",
    "tutor_registration_submit_failed",
    "tutor_registration_succeeded",
    "demo_login_succeeded",
    "demo_account_registered",
    "demo_logout",
    "profile_viewed",
    "tutor_profile_saved",
    "caregiver_profile_saved",
    "pet_profile_viewed",
    "pet_profile_saved",
]
EventMetadataValue = bool | float | int | str | None

ALLOWED_METADATA_KEYS = {"action", "count", "invalid_fields", "profile_id", "reason"}


class UsageEventCreate(BaseModel):
    session_id: SessionId
    event_name: EventName
    screen: Literal[
        "home",
        "login",
        "account_registration",
        "profile",
        "tutor_registration",
        "tutor_profile",
        "caregiver_profile",
        "pet_profile",
        "pet_form",
    ]
    platform: Literal["android", "ios", "web"]
    metadata: dict[str, EventMetadataValue] = Field(default_factory=dict)

    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, value: dict[str, EventMetadataValue]):
        unexpected_keys = set(value) - ALLOWED_METADATA_KEYS
        if unexpected_keys:
            raise ValueError("metadata contains unsupported keys")
        if len(value) > 8:
            raise ValueError("metadata contains too many entries")
        if any(isinstance(item, str) and len(item) > 160 for item in value.values()):
            raise ValueError("metadata value is too long")
        return value


class UsageEventCreated(BaseModel):
    id: int
    received_at: datetime


class DashboardMetrics(BaseModel):
    active_sessions: int
    events_today: int
    profile_saves: int
    accounts_created: int


class DashboardEvent(BaseModel):
    id: int
    session_id: str
    event_name: str
    screen: str
    platform: str
    metadata: dict[str, EventMetadataValue]
    received_at: datetime


class DashboardSnapshot(BaseModel):
    metrics: DashboardMetrics
    events: list[DashboardEvent]
