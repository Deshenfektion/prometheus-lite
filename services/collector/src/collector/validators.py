from __future__ import annotations

import math
from collections.abc import Mapping
from dataclasses import dataclass

from collector.logging_setup import get_logger

log = get_logger("validators")


@dataclass(frozen=True, slots=True)
class Bounds:
    minimum: float
    maximum: float
    discrete: tuple[float, ...] | None = None
    integral: bool = False

    def check(self, value: float) -> str | None:
        if not math.isfinite(value):
            return "value is not finite"
        if self.discrete is not None and value not in self.discrete:
            allowed = ", ".join(str(item) for item in self.discrete)
            return f"value must be one of {allowed}"
        if self.integral and value != int(value):
            return "value must be an integer"
        if value < self.minimum or value > self.maximum:
            return f"value must be between {self.minimum} and {self.maximum}"
        return None


BOUNDS: Mapping[str, Bounds] = {
    "availability": Bounds(0, 1, discrete=(0.0, 1.0)),
    "http_status": Bounds(100, 599, integral=True),
    "latency_ms": Bounds(0, 600_000),
    "latency_avg_ms": Bounds(0, 600_000),
    "latency_p95_ms": Bounds(0, 600_000),
    "latency_p99_ms": Bounds(0, 600_000),
    "cpu_percent": Bounds(0, 100),
    "memory_percent": Bounds(0, 100),
    "throughput_rps": Bounds(0, 1_000_000),
    "error_rate": Bounds(0, 1),
}


def validate_metrics(service: str, metrics: Mapping[str, float]) -> dict[str, float]:
    accepted: dict[str, float] = {}

    for key, value in metrics.items():
        bounds = BOUNDS.get(key)
        if bounds is None:
            log.warning("unknown_metric_dropped", service=service, metric=key)
            continue

        problem = bounds.check(value)
        if problem is not None:
            log.warning(
                "invalid_metric_dropped",
                service=service,
                metric=key,
                value=value,
                reason=problem,
            )
            continue

        accepted[key] = float(value)

    return accepted
