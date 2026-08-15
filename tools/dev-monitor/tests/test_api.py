from __future__ import annotations

import logging
import os
import sqlite3

from fastapi.testclient import TestClient

from tranquilo_pet_monitor.config import Settings
from tranquilo_pet_monitor.main import create_app


def test_health_and_empty_dashboard(client):
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    dashboard = client.get("/api/dashboard/snapshot")
    assert dashboard.status_code == 200
    assert dashboard.json()["metrics"] == {
        "active_sessions": 0,
        "events_today": 0,
        "profile_saves": 0,
        "accounts_created": 0,
    }
    assert "tutors" not in dashboard.json()


def test_event_is_persisted_counted_and_logged_without_metadata(client, caplog):
    caplog.set_level(logging.INFO, logger="tranquilo_pet_monitor.activity")
    response = client.post(
        "/api/events",
        json={
            "session_id": "android-session-1",
            "event_name": "interaction_test_pressed",
            "screen": "home",
            "platform": "android",
            "metadata": {"count": 2},
        },
    )

    assert response.status_code == 201
    snapshot = client.get("/api/dashboard/snapshot").json()
    assert snapshot["metrics"]["events_today"] == 1
    assert snapshot["metrics"]["active_sessions"] == 1
    assert snapshot["events"][0]["metadata"] == {"count": 2}
    assert "interaction_test_pressed" in caplog.text
    assert '"count": 2' not in caplog.text


def test_new_profile_events_are_accepted_and_counted_without_profile_data(client):
    events = (
        ("tutor_profile_saved", "tutor_profile"),
        ("caregiver_profile_saved", "caregiver_profile"),
        ("pet_profile_saved", "pet_form"),
        ("demo_account_registered", "account_registration"),
    )
    for event_name, screen in events:
        response = client.post(
            "/api/events",
            json={
                "session_id": "android-session-1",
                "event_name": event_name,
                "screen": screen,
                "platform": "android",
                "metadata": {"action": "create"},
            },
        )
        assert response.status_code == 201

    snapshot = client.get("/api/dashboard/snapshot").json()
    assert snapshot["metrics"]["profile_saves"] == 3
    assert snapshot["metrics"]["accounts_created"] == 1
    assert "tutors" not in snapshot


def test_rejects_invalid_or_oversized_payload(client):
    invalid = client.post(
        "/api/events",
        json={
            "session_id": "short",
            "event_name": "unknown_event",
            "screen": "home",
            "platform": "android",
        },
    )
    oversized = client.post(
        "/api/events",
        content=b"x" * 70_000,
        headers={"Content-Type": "application/json", "Content-Length": "1"},
    )

    assert invalid.status_code == 422
    assert oversized.status_code == 413


def test_legacy_tutor_endpoint_and_contact_table_are_not_exposed(client):
    payload = {
        "session_id": "android-session-1",
        "submission_id": "tutor-submission-1",
        "full_name": "Ana Souza",
        "email": "ana@example.test",
        "phone": "47999991234",
        "city": "Rio do Sul",
        "state": "SC",
    }

    assert client.post("/api/tutors", json=payload).status_code == 404
    assert "/api/tutors" not in client.get("/openapi.json").json()["paths"]

    html = client.get("/").text
    javascript = client.get("/static/app.js").text
    assert "tutors-table" not in html
    assert "Contato protegido" not in html
    assert "renderTutors" not in javascript


def test_existing_legacy_tutor_table_is_preserved_but_inaccessible(tmp_path):
    database_path = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(database_path) as connection:
        connection.executescript(
            """
            CREATE TABLE tutor_profiles (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL
            );
            INSERT INTO tutor_profiles (id, full_name, email, phone)
            VALUES ('legacy-1', 'Legacy Test', 'legacy@example.test', '47999991234');
            """
        )

    settings = Settings(database_path=database_path)
    with TestClient(create_app(settings)) as local_client:
        assert local_client.post("/api/tutors", json={}).status_code == 404
        snapshot = local_client.get("/api/dashboard/snapshot").json()
        assert "tutors" not in snapshot

    with sqlite3.connect(database_path) as connection:
        count = connection.execute("SELECT COUNT(*) FROM tutor_profiles").fetchone()[0]
    assert count == 1


def test_sqlite_file_is_released_after_each_request(tmp_path):
    database_path = tmp_path / "releasable.sqlite3"
    settings = Settings(database_path=database_path)

    with TestClient(create_app(settings)) as local_client:
        assert local_client.get("/api/dashboard/snapshot").status_code == 200

    renamed_path = database_path.with_name("renamed.sqlite3")
    os.replace(database_path, renamed_path)
    assert renamed_path.exists()


def test_dashboard_is_local_only_but_phone_ingestion_is_available(tmp_path):
    settings = Settings(database_path=tmp_path / "remote.sqlite3")
    app = create_app(settings)

    with TestClient(app, client=("192.168.1.55", 4321)) as remote_client:
        assert remote_client.get("/").status_code == 403
        assert remote_client.get("/api/dashboard/snapshot").status_code == 403
        assert remote_client.get("/redoc").status_code == 403
        assert remote_client.get("/api/health").status_code == 200
        response = remote_client.post(
            "/api/events",
            json={
                "session_id": "android-session-remote",
                "event_name": "app_opened",
                "screen": "home",
                "platform": "android",
            },
        )
        assert response.status_code == 201


def test_public_tunnel_allows_only_health_and_event_ingestion(tmp_path):
    settings = Settings(database_path=tmp_path / "public.sqlite3")

    with TestClient(create_app(settings), client=("8.8.8.8", 4321)) as public_client:
        assert public_client.get("/").status_code == 403
        assert public_client.get("/api/dashboard/snapshot").status_code == 403
        assert public_client.get("/docs").status_code == 403
        assert public_client.get("/api/health").status_code == 200

        response = public_client.post(
            "/api/events",
            json={
                "session_id": "android-session-tunnel",
                "event_name": "app_opened",
                "screen": "home",
                "platform": "android",
            },
        )
        assert response.status_code == 201
