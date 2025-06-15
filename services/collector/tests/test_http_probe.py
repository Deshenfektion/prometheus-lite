from __future__ import annotations

import httpx
import pytest
import respx

from collector.collectors import HttpProbe, probe_metrics
from collector.config import TargetConfig

PROBE_URL = "http://checkout.test/health"


@respx.mock
async def test_successful_probe_reports_availability(
    client: httpx.AsyncClient, target: TargetConfig
) -> None:
    respx.get(PROBE_URL).mock(return_value=httpx.Response(200, json={"status": "ok"}))

    outcome = await HttpProbe(client).probe(target)

    assert outcome.reachable is True
    assert outcome.healthy is True
    assert outcome.status_code == 200
    assert outcome.latency_ms >= 0
    assert outcome.payload == {"status": "ok"}


@respx.mock
async def test_server_error_is_unhealthy_but_reachable(
    client: httpx.AsyncClient, target: TargetConfig
) -> None:
    respx.get(PROBE_URL).mock(return_value=httpx.Response(503, text="unavailable"))

    outcome = await HttpProbe(client).probe(target)

    assert outcome.reachable is True
    assert outcome.healthy is False
    assert outcome.status_code == 503
    assert outcome.payload is None


@respx.mock
async def test_timeout_records_configured_timeout_as_latency(
    client: httpx.AsyncClient, target: TargetConfig
) -> None:
    respx.get(PROBE_URL).mock(side_effect=httpx.ConnectTimeout("timed out"))

    outcome = await HttpProbe(client).probe(target)

    assert outcome.reachable is False
    assert outcome.status_code is None
    assert outcome.error == "timeout"
    assert outcome.latency_ms == pytest.approx(target.timeout_ms)


@respx.mock
async def test_connection_error_is_reported(
    client: httpx.AsyncClient, target: TargetConfig
) -> None:
    respx.get(PROBE_URL).mock(side_effect=httpx.ConnectError("refused"))

    outcome = await HttpProbe(client).probe(target)

    assert outcome.reachable is False
    assert outcome.error == "ConnectError"


@respx.mock
async def test_non_json_body_is_not_parsed(
    client: httpx.AsyncClient, target: TargetConfig
) -> None:
    respx.get(PROBE_URL).mock(
        return_value=httpx.Response(200, text="ok", headers={"content-type": "text/plain"})
    )

    outcome = await HttpProbe(client).probe(target)

    assert outcome.payload is None


@respx.mock
async def test_collect_maps_outcome_to_metric_keys(
    client: httpx.AsyncClient, target: TargetConfig
) -> None:
    respx.get(PROBE_URL).mock(return_value=httpx.Response(200, json={"status": "ok"}))

    metrics = await HttpProbe(client).collect(target)

    assert metrics["availability"] == 1.0
    assert metrics["http_status"] == 200.0
    assert "latency_ms" in metrics


def test_probe_metrics_omits_status_when_unreachable() -> None:
    from collector.models import ProbeOutcome

    metrics = probe_metrics(
        ProbeOutcome(
            service="checkout-api",
            reachable=False,
            status_code=None,
            latency_ms=500.0,
            error="timeout",
        )
    )

    assert metrics == {"availability": 0.0, "latency_ms": 500.0}
