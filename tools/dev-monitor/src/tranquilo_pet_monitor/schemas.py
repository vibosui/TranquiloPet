from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


SessionId = Annotated[str, Field(min_length=8, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")]
EventName = Literal[
    "app_opened",
    "interaction_test_pressed",
    "tutor_registration_opened",
    "tutor_registration_submit_started",
    "tutor_registration_validation_failed",
    "tutor_registration_submit_failed",
    "tutor_registration_succeeded",
]
EventMetadataValue = bool | float | int | str | None

BRAZILIAN_STATES = {
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
}
ALLOWED_METADATA_KEYS = {"count", "invalid_fields", "profile_id", "reason"}


class UsageEventCreate(BaseModel):
    session_id: SessionId
    event_name: EventName
    screen: Literal["home", "tutor_registration"]
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


class TutorProfileCreate(BaseModel):
    session_id: SessionId
    submission_id: SessionId
    full_name: str = Field(min_length=3, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=20)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=2)

    @field_validator("full_name", "city", mode="before")
    @classmethod
    def normalize_text(cls, value: object):
        if not isinstance(value, str):
            raise ValueError("value must be a string")
        return " ".join(value.strip().split())

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object):
        if not isinstance(value, str):
            raise ValueError("email must be a string")
        return str(value).strip().lower()

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: object):
        if not isinstance(value, str):
            raise ValueError("phone must be a string")
        digits = "".join(character for character in value if character.isdigit())
        if len(digits) not in {10, 11}:
            raise ValueError("phone must contain 10 or 11 digits")
        return digits

    @field_validator("state", mode="before")
    @classmethod
    def normalize_state(cls, value: object):
        if not isinstance(value, str):
            raise ValueError("state must be a string")
        normalized = value.strip().upper()
        if normalized not in BRAZILIAN_STATES:
            raise ValueError("invalid Brazilian state")
        return normalized


class TutorProfileCreated(BaseModel):
    id: str
    created_at: datetime


class DashboardMetrics(BaseModel):
    active_sessions: int
    events_today: int
    tutor_profiles: int
    successful_registrations: int


class DashboardEvent(BaseModel):
    id: int
    session_id: str
    event_name: str
    screen: str
    platform: str
    metadata: dict[str, EventMetadataValue]
    received_at: datetime


class DashboardTutor(BaseModel):
    id: str
    full_name: str
    masked_email: str
    masked_phone: str
    city: str
    state: str
    created_at: datetime


class DashboardSnapshot(BaseModel):
    metrics: DashboardMetrics
    events: list[DashboardEvent]
    tutors: list[DashboardTutor]
