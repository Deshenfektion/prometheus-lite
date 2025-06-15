from __future__ import annotations

import asyncio
from datetime import UTC

import pytest

from collector.config import TargetConfig
from collector.models import MetricSnapshot
from collector.scheduler import PollScheduler


def make_target(slug: str, interval: float = 0.02) -> TargetConfig:
    return TargetConfig(
        slug=slug,
        display_name=slug,
        base_url=f"http://{slug}.test",
        interval_seconds=interval,
    )


async def test_poll_once_emits_snapshot_with_utc_timestamp() -> None:
    received: list[MetricSnapshot] = []

    async def collect(_: TargetConfig) -> dict[str, float]:
        return {"availability": 1.0, "latency_ms": 12.5}

    async def sink(snapshot: MetricSnapshot) -> None:
        received.append(snapshot)

    target = make_target("checkout-api")
    scheduler = PollScheduler(targets=[target], collect=collect, sink=sink, jitter=False)

    snapshot = await scheduler.poll_once(target)

    assert snapshot is not None
    assert snapshot.service == "checkout-api"
    assert snapshot.recorded_at.tzinfo == UTC
    assert received == [snapshot]


async def test_collection_failure_is_isolated() -> None:
    async def collect(_: TargetConfig) -> dict[str, float]:
        raise RuntimeError("probe exploded")

    async def sink(_: MetricSnapshot) -> None:
        raise AssertionError("sink must not be called on failure")

    target = make_target("checkout-api")
    scheduler = PollScheduler(targets=[target], collect=collect, sink=sink, jitter=False)

    assert await scheduler.poll_once(target) is None
    assert scheduler.state["checkout-api"].consecutive_failures == 1

    assert await scheduler.poll_once(target) is None
    assert scheduler.state["checkout-api"].consecutive_failures == 2


async def test_failure_counter_resets_after_recovery() -> None:
    outcomes = iter([RuntimeError("down"), None])

    async def collect(_: TargetConfig) -> dict[str, float]:
        outcome = next(outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return {"availability": 1.0}

    async def sink(_: MetricSnapshot) -> None:
        return None

    target = make_target("checkout-api")
    scheduler = PollScheduler(targets=[target], collect=collect, sink=sink, jitter=False)

    await scheduler.poll_once(target)
    await scheduler.poll_once(target)

    assert scheduler.state["checkout-api"].consecutive_failures == 0
    assert scheduler.state["checkout-api"].polls == 2


async def test_targets_are_polled_concurrently_on_their_own_intervals() -> None:
    counts: dict[str, int] = {"fast": 0, "slow": 0}

    async def collect(target: TargetConfig) -> dict[str, float]:
        counts[target.slug] += 1
        return {"availability": 1.0}

    async def sink(_: MetricSnapshot) -> None:
        return None

    targets = [make_target("fast", interval=0.01), make_target("slow", interval=0.1)]
    scheduler = PollScheduler(targets=targets, collect=collect, sink=sink, jitter=False)

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(scheduler.run(), timeout=0.2)

    assert counts["fast"] > counts["slow"]
    assert counts["slow"] >= 1


async def test_run_returns_immediately_without_targets() -> None:
    async def collect(_: TargetConfig) -> dict[str, float]:
        raise AssertionError("should not be called")

    async def sink(_: MetricSnapshot) -> None:
        return None

    scheduler = PollScheduler(targets=[], collect=collect, sink=sink, jitter=False)
    await asyncio.wait_for(scheduler.run(), timeout=0.1)
