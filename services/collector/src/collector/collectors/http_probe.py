from __future__ import annotations

import time
from typing import Any

import httpx

from collector.config import TargetConfig
from collector.models import ProbeOutcome

MAX_PROBE_LATENCY_MS = 120_000.0


def _decode_payload(response: httpx.Response) -> dict[str, Any] | None:
    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        return None
    try:
        body = response.json()
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


class HttpProbe:
    name = "http_probe"

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def probe(self, target: TargetConfig) -> ProbeOutcome:
        timeout = target.timeout_ms / 1000
        started = time.perf_counter()

        try:
            response = await self._client.get(target.probe_url, timeout=timeout)
        except httpx.TimeoutException:
            return ProbeOutcome(
                service=target.slug,
                reachable=False,
                status_code=None,
                latency_ms=round(target.timeout_ms, 3),
                error="timeout",
            )
        except httpx.HTTPError as error:
            return ProbeOutcome(
                service=target.slug,
                reachable=False,
                status_code=None,
                latency_ms=round((time.perf_counter() - started) * 1000, 3),
                error=type(error).__name__,
            )

        elapsed_ms = min((time.perf_counter() - started) * 1000, MAX_PROBE_LATENCY_MS)
        return ProbeOutcome(
            service=target.slug,
            reachable=True,
            status_code=response.status_code,
            latency_ms=round(elapsed_ms, 3),
            payload=_decode_payload(response),
        )

    async def collect(self, target: TargetConfig) -> dict[str, float]:
        return probe_metrics(await self.probe(target))


def probe_metrics(outcome: ProbeOutcome) -> dict[str, float]:
    metrics: dict[str, float] = {
        "availability": 1.0 if outcome.healthy else 0.0,
        "latency_ms": outcome.latency_ms,
    }
    if outcome.status_code is not None:
        metrics["http_status"] = float(outcome.status_code)
    return metrics
