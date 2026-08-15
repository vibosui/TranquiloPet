from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager


class LiveEventBus:
    def __init__(self, queue_size: int = 100):
        self._queue_size = queue_size
        self._subscribers: set[asyncio.Queue[str]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def publish(self, message: str) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        loop.call_soon_threadsafe(self._publish_on_event_loop, message)

    def _publish_on_event_loop(self, message: str) -> None:
        for queue in tuple(self._subscribers):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(message)

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[str]]:
        running_loop = asyncio.get_running_loop()
        if self._loop is None:
            self._loop = running_loop
        elif self._loop is not running_loop:
            raise RuntimeError("LiveEventBus supports a single event loop")

        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=self._queue_size)
        self._subscribers.add(queue)
        try:
            yield queue
        finally:
            self._subscribers.discard(queue)
