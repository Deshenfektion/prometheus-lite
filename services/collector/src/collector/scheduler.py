from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from collector.config import TargetConfig
from collector.logging_setup import get_logger
from collector.models import MetricSnapshot
from collector.timeutil import utc_now
from collector.validators import validate_metrics

log = get_logger("scheduler")

CollectFn = Callable[[TargetConfig], Awaitable[dict[str, float]]]
SinkFn = Callable[[MetricSnapshot], Awaitable[None]]


@dataclass(slots=True)
class TargetState:
    consecutive_failures: int = 0
    polls: int = 0


@dataclass(slots=True)
class PollScheduler:
    targets: list[TargetConfig]
    collect: CollectFn
    sink: SinkFn
    jitter: bool = True
    state: dict[str, TargetState] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for target in self.targets:
            self.state.setdefault(target.slug, TargetState())

    async def poll_once(self, target: TargetConfig) -> MetricSnapshot | None:
        state = self.state[target.slug]
        state.polls += 1
        started_at = utc_now()
        try:
            metrics = await self.collect(target)
        except Exception as error:
            state.consecutive_failures += 1
            log.warning(
                "collection_failed",
                slug=target.slug,
                error=str(error),
                consecutive_failures=state.consecutive_failures,
            )
            return None

        state.consecutive_failures = 0
        accepted = validate_metrics(target.slug, metrics)
        if not accepted:
            log.warning("snapshot_empty_after_validation", slug=target.slug)
            return None

        snapshot = MetricSnapshot(
            service=target.slug,
            recorded_at=started_at,
            metrics=accepted,
        )
        await self.sink(snapshot)
        return snapshot

    async def _run_target(self, target: TargetConfig) -> None:
        if self.jitter:
            await asyncio.sleep(random.uniform(0, min(target.interval_seconds, 5.0)))

        loop = asyncio.get_running_loop()
        next_tick = loop.time()

        while True:
            await self.poll_once(target)
            next_tick += target.interval_seconds
            delay = next_tick - loop.time()
            if delay < 0:
                missed = int(-delay // target.interval_seconds) + 1
                next_tick += missed * target.interval_seconds
                log.warning("poll_overrun", slug=target.slug, skipped_intervals=missed)
                delay = max(next_tick - loop.time(), 0.0)
            await asyncio.sleep(delay)

    async def run(self) -> None:
        if not self.targets:
            log.warning("no_targets_configured")
            return

        log.info("scheduler_started", targets=len(self.targets))
        async with asyncio.TaskGroup() as group:
            for target in self.targets:
                group.create_task(self._run_target(target), name=f"poll:{target.slug}")
