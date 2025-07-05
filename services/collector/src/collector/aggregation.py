from __future__ import annotations

import math
import time
from collections import deque
from collections.abc import Sequence
from dataclasses import dataclass, field

MIN_SAMPLES_FOR_PERCENTILES = 5


def percentile(values: Sequence[float], fraction: float) -> float:
    if not values:
        raise ValueError("percentile of an empty sequence is undefined")
    if not 0 < fraction <= 1:
        raise ValueError("fraction must be in (0, 1]")

    ordered = sorted(values)
    rank = math.ceil(fraction * len(ordered))
    return ordered[rank - 1]


@dataclass(frozen=True, slots=True)
class Sample:
    at: float
    latency_ms: float
    available: bool


@dataclass(slots=True)
class RollingWindow:
    max_samples: int = 120
    max_age_seconds: float = 300.0
    samples: deque[Sample] = field(default_factory=deque)

    def add(self, latency_ms: float, available: bool, now: float | None = None) -> None:
        moment = time.monotonic() if now is None else now
        self.samples.append(Sample(at=moment, latency_ms=latency_ms, available=available))
        self._prune(moment)

    def _prune(self, now: float) -> None:
        cutoff = now - self.max_age_seconds
        while self.samples and self.samples[0].at < cutoff:
            self.samples.popleft()
        while len(self.samples) > self.max_samples:
            self.samples.popleft()

    def __len__(self) -> int:
        return len(self.samples)

    def latencies(self) -> list[float]:
        return [sample.latency_ms for sample in self.samples]

    def summary(self) -> dict[str, float]:
        if not self.samples:
            return {}

        latencies = self.latencies()
        failures = sum(1 for sample in self.samples if not sample.available)

        metrics: dict[str, float] = {
            "latency_avg_ms": round(sum(latencies) / len(latencies), 3),
            "error_rate": round(failures / len(self.samples), 4),
        }

        if len(latencies) >= MIN_SAMPLES_FOR_PERCENTILES:
            metrics["latency_p95_ms"] = round(percentile(latencies, 0.95), 3)
            metrics["latency_p99_ms"] = round(percentile(latencies, 0.99), 3)

        return metrics


@dataclass(slots=True)
class WindowRegistry:
    max_samples: int = 120
    max_age_seconds: float = 300.0
    windows: dict[str, RollingWindow] = field(default_factory=dict)

    def window(self, service: str) -> RollingWindow:
        existing = self.windows.get(service)
        if existing is None:
            existing = RollingWindow(
                max_samples=self.max_samples,
                max_age_seconds=self.max_age_seconds,
            )
            self.windows[service] = existing
        return existing

    def observe(self, service: str, latency_ms: float, available: bool) -> dict[str, float]:
        window = self.window(service)
        window.add(latency_ms, available)
        return window.summary()
