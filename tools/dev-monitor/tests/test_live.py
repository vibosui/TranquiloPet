from __future__ import annotations

import asyncio
from threading import Thread

from tranquilo_pet_monitor.live import LiveEventBus


def test_publish_from_request_thread_wakes_sse_event_loop():
    async def scenario():
        bus = LiveEventBus()
        async with bus.subscribe() as queue:
            publisher = Thread(target=bus.publish, args=("updated",))
            publisher.start()
            publisher.join()
            assert await asyncio.wait_for(queue.get(), timeout=1) == "updated"

    asyncio.run(scenario())
