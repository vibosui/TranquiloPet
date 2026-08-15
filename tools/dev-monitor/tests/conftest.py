from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from tranquilo_pet_monitor.config import Settings
from tranquilo_pet_monitor.main import create_app


@pytest.fixture
def client(tmp_path) -> Iterator[TestClient]:
    settings = Settings(database_path=tmp_path / "monitor.sqlite3")
    with TestClient(create_app(settings)) as test_client:
        yield test_client
