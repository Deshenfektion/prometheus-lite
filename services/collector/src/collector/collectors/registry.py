from __future__ import annotations

from dataclasses import dataclass, field

from collector.aggregation import WindowRegistry
from collector.collectors.http_probe import HttpProbe, probe_metrics
from collector.collectors.telemetry import extract_telemetry
from collector.config import TargetConfig


@dataclass(slots=True)
class MetricsAssembler:
    probe: HttpProbe
    windows: WindowRegistry = field(default_factory=WindowRegistry)

    async def collect(self, target: TargetConfig) -> dict[str, float]:
        outcome = await self.probe.probe(target)

        metrics = probe_metrics(outcome)
        metrics.update(extract_telemetry(outcome.payload))
        metrics.update(
            self.windows.observe(
                target.slug,
                latency_ms=outcome.latency_ms,
                available=outcome.healthy,
            )
        )
        return metrics
