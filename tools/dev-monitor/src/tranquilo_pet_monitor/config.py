from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _default_data_directory() -> Path:
    local_app_data = os.getenv("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "TranquiloPet" / "dev-monitor"
    return Path.home() / ".tranquilo-pet" / "dev-monitor"


@dataclass(frozen=True, slots=True)
class Settings:
    host: str = "0.0.0.0"
    port: int = 8000
    database_path: Path = _default_data_directory() / "monitor.sqlite3"
    max_request_bytes: int = 65_536

    @classmethod
    def from_environment(cls) -> "Settings":
        database_path = Path(
            os.getenv("TRANQUILO_PET_MONITOR_DB", str(_default_data_directory() / "monitor.sqlite3"))
        )
        return cls(
            host=os.getenv("TRANQUILO_PET_MONITOR_HOST", "0.0.0.0"),
            port=int(os.getenv("TRANQUILO_PET_MONITOR_PORT", "8000")),
            database_path=database_path,
        )
