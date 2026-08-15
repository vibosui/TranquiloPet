from __future__ import annotations

import logging
import os

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
        "tutor_profiles": 0,
        "successful_registrations": 0,
    }


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


def test_tutor_profile_is_persisted_masked_and_unique(client, caplog):
    caplog.set_level(logging.INFO, logger="tranquilo_pet_monitor.activity")
    payload = {
        "session_id": "android-session-1",
        "submission_id": "tutor-submission-1",
        "full_name": "Ana Souza",
        "email": "ANA@EMAIL.COM",
        "phone": "(47) 99999-1234",
        "city": "Rio do Sul",
        "state": "sc",
    }

    created = client.post("/api/tutors", json=payload)
    repeated_submission = client.post("/api/tutors", json=payload)
    duplicate_email = client.post(
        "/api/tutors",
        json={**payload, "submission_id": "tutor-submission-2"},
    )

    assert created.status_code == 201
    assert repeated_submission.status_code == 201
    assert repeated_submission.json()["id"] == created.json()["id"]
    assert duplicate_email.status_code == 409

    snapshot = client.get("/api/dashboard/snapshot").json()
    assert snapshot["metrics"]["tutor_profiles"] == 1
    tutor = snapshot["tutors"][0]
    assert tutor["full_name"] == "Ana Souza"
    assert tutor["masked_email"] == "an*******@email.com"
    assert tutor["masked_phone"] == "(**) *****-1234"
    assert "ana@email.com" not in caplog.text.lower()
    assert "47999991234" not in caplog.text


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


def test_rejects_values_that_are_too_short_after_normalization(client):
    response = client.post(
        "/api/tutors",
        json={
            "session_id": "android-session-1",
            "submission_id": "tutor-invalid-fields",
            "full_name": "  A  ",
            "email": "ana@email.com",
            "phone": "(47) 99999-1234",
            "city": "  X  ",
            "state": " sc ",
        },
    )

    assert response.status_code == 422


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


def test_public_network_clients_are_rejected(tmp_path):
    settings = Settings(database_path=tmp_path / "public.sqlite3")

    with TestClient(create_app(settings), client=("8.8.8.8", 4321)) as public_client:
        assert public_client.get("/api/health").status_code == 403
