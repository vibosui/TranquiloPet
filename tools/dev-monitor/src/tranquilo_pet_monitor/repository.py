from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from .schemas import UsageEventCreate


@dataclass(frozen=True, slots=True)
class CreatedRecord:
    id: int
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

                """
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
                    (SELECT COUNT(*) FROM events
                        WHERE received_at >= ?
                        AND event_name IN (
                            'tutor_profile_saved',
                            'caregiver_profile_saved',
                            'pet_profile_saved'
                        ))
                        AS profile_saves,
                    (SELECT COUNT(*) FROM events
                        WHERE received_at >= ?
                        AND event_name = 'demo_account_registered')
                        AS accounts_created
                """,
                (active_since, start_of_day, start_of_day, start_of_day),
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
