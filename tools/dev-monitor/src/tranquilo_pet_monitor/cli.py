from __future__ import annotations

import logging

import uvicorn

from .config import Settings
from .main import create_app


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    settings = Settings.from_environment()
    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        log_level="info",
        workers=1,
    )


if __name__ == "__main__":
    main()
