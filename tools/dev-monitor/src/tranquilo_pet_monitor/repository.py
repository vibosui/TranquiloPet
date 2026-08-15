from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from .schemas import TutorProfileCreate, UsageEventCreate


class DuplicateTutorEmailError(Exception):
    """Raised when an e-mail already belongs to a local tutor profile."""


@dataclass(frozen=True, slots=True)
class CreatedRecord:
    id: int | str
    created_at: datetime


class SQLiteMonitorRepository:
    def __init__(self, database_path: Path):
        self._database_path = database_path

    def initialize(self) -> None:
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    event_name TEXT NOT NULL,
                    screen TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    received_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_events_received_at
                    ON events(received_at DESC);
                CREATE INDEX IF NOT EXISTS idx_events_session_id
                    ON events(session_id);

                CREATE TABLE IF NOT EXISTS tutor_profiles (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    submission_id TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    phone TEXT NOT NULL,
                    city TEXT NOT NULL,
                    state TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_tutor_profiles_created_at
                    ON tutor_profiles(created_at DESC);
                """
            )
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(tutor_profiles)").fetchall()
            }
            if "submission_id" not in columns:
                connection.execute("ALTER TABLE tutor_profiles ADD COLUMN submission_id TEXT")
                connection.execute(
                    "UPDATE tutor_profiles SET submission_id = 'legacy-' || id "
                    "WHERE submission_id IS NULL"
                )
            connection.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_profiles_submission_id "
                "ON tutor_profiles(submission_id)"
            )

    def insert_event(self, event: UsageEventCreate) -> CreatedRecord:
        received_at = datetime.now(UTC)
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO events (
                    session_id, event_name, screen, platform, metadata_json, received_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    event.session_id,
                    event.event_name,
                    event.screen,
                    event.platform,
                    json.dumps(event.metadata, ensure_ascii=False, separators=(",", ":")),
                    received_at.isoformat(),
                ),
            )
            return CreatedRecord(id=int(cursor.lastrowid), created_at=received_at)

    def insert_tutor(self, profile: TutorProfileCreate) -> CreatedRecord:
        profile_id = str(uuid4())
        created_at = datetime.now(UTC)
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO tutor_profiles (
                        id, session_id, submission_id, full_name, email, phone, city, state,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        profile_id,
                        profile.session_id,
                        profile.submission_id,
                        profile.full_name,
                        str(profile.email),
                        profile.phone,
                        profile.city,
                        profile.state,
                        created_at.isoformat(),
                    ),
                )
        except sqlite3.IntegrityError as error:
            error_message = str(error).lower()
            if "submission_id" in error_message:
                with self._connect() as connection:
                    existing = connection.execute(
                        "SELECT id, created_at FROM tutor_profiles WHERE submission_id = ?",
                        (profile.submission_id,),
                    ).fetchone()
                if existing is not None:
                    return CreatedRecord(
                        id=existing["id"],
                        created_at=datetime.fromisoformat(existing["created_at"]),
                    )
            if "email" in error_message:
                raise DuplicateTutorEmailError from error
            raise
        return CreatedRecord(id=profile_id, created_at=created_at)

    def dashboard_metrics(self) -> dict[str, int]:
        now = datetime.now(UTC)
        local_now = datetime.now().astimezone()
        start_of_day = (
            local_now.replace(hour=0, minute=0, second=0, microsecond=0)
            .astimezone(UTC)
            .isoformat()
        )
        active_since = (now - timedelta(minutes=5)).isoformat()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    (SELECT COUNT(DISTINCT session_id) FROM events WHERE received_at >= ?)
                        AS active_sessions,
                    (SELECT COUNT(*) FROM events WHERE received_at >= ?) AS events_today,
                    (SELECT COUNT(*) FROM tutor_profiles) AS tutor_profiles,
                    (SELECT COUNT(*) FROM events
                        WHERE event_name = 'tutor_registration_succeeded')
                        AS successful_registrations
                """,
                (active_since, start_of_day),
            ).fetchone()
        return dict(row)

    def recent_events(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, session_id, event_name, screen, platform, metadata_json, received_at
                FROM events
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                **dict(row),
                "metadata": json.loads(row["metadata_json"]),
            }
            for row in rows
        ]

    def recent_tutors(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, full_name, email, phone, city, state, created_at
                FROM tutor_profiles
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self._database_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout = 5000")
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()
