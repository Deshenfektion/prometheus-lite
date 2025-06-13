from __future__ import annotations

from typing import Protocol, runtime_checkable

from collector.config import TargetConfig


@runtime_checkable
class MetricSource(Protocol):
    name: str

    async def collect(self, target: TargetConfig) -> dict[str, float]: ...
