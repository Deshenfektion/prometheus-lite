from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import psutil

from collector.logging_setup import get_logger
from collector.models import MetricSnapshot
from collector.timeutil import utc_now

log = get_logger("system")


@dataclass(slots=True)
class SystemSampler:
    name: str = "system"

    def __post_init__(self) -> None:
        psutil.cpu_percent(interval=None)

    def sample(self) -> dict[str, float]:
        return {
            "cpu_percent": round(psutil.cpu_percent(interval=None), 2),
            "memory_percent": round(psutil.virtual_memory().percent, 2),
        }


async def run_self_monitor(
    service_slug: str,
    interval_seconds: float,
    sink: Callable[[MetricSnapshot], Awaitable[None]],
    sampler: SystemSampler | None = None,
) -> None:
    active = sampler if sampler is not None else SystemSampler()
    log.info("self_monitor_started", service=service_slug, interval=interval_seconds)

    loop = asyncio.get_running_loop()
    next_tick = loop.time()

    while True:
        await sink(
            MetricSnapshot(
                service=service_slug,
                recorded_at=utc_now(),
                metrics=active.sample(),
            )
        )
        next_tick += interval_seconds
        await asyncio.sleep(max(next_tick - loop.time(), 0.0))
