from __future__ import annotations

import httpx
import respx

from collector.collectors import HttpProbe, MetricsAssembler, extract_telemetry
from collector.config import TargetConfig

PROBE_URL = "http://checkout.test/health"


def test_flat_snake_case_fields_are_read() -> None:
    payload = {"status": "ok", "cpu_percent": 31.5, "memory_percent": 64.0}
    assert extract_telemetry(payload) == {"cpu_percent": 31.5, "memory_percent": 64.0}


def test_camel_case_aliases_are_read() -> None:
    payload = {"cpuPercent": 12, "memoryPercent": 44, "requestsPerSecond": 128}
    assert extract_telemetry(payload) == {
        "cpu_percent": 12.0,
        "memory_percent": 44.0,
        "throughput_rps": 128.0,
    }


def test_nested_metrics_object_is_searched() -> None:
    payload = {"status": "ok", "metrics": {"cpu": 8.25, "rps": 42}}
    assert extract_telemetry(payload) == {"cpu_percent": 8.25, "throughput_rps": 42.0}


def test_flat_fields_win_over_nested_ones() -> None:
    payload = {"cpu_percent": 10.0, "metrics": {"cpu_percent": 90.0}}
    assert extract_telemetry(payload)["cpu_percent"] == 10.0


def test_numeric_strings_are_coerced() -> None:
    assert extract_telemetry({"cpu_percent": "17.5"}) == {"cpu_percent": 17.5}


def test_unusable_values_are_skipped() -> None:
    payload = {"cpu_percent": "warm", "memory_percent": None, "throughput_rps": True}
    assert extract_telemetry(payload) == {}


def test_empty_and_missing_payloads_yield_nothing() -> None:
    assert extract_telemetry(None) == {}
    assert extract_telemetry({}) == {}
    assert extract_telemetry({"status": "ok"}) == {}


@respx.mock
async def test_assembler_merges_probe_telemetry_and_window_metrics(
    client: httpx.AsyncClient, target: TargetConfig
) -> None:
    respx.get(PROBE_URL).mock(
        return_value=httpx.Response(
            200, json={"status": "ok", "cpu_percent": 22.0, "requestsPerSecond": 15}
        )
    )
    assembler = MetricsAssembler(probe=HttpProbe(client))

    metrics = await assembler.collect(target)

    assert metrics["availability"] == 1.0
    assert metrics["http_status"] == 200.0
    assert metrics["cpu_percent"] == 22.0
    assert metrics["throughput_rps"] == 15.0
    assert "latency_avg_ms" in metrics
    assert metrics["error_rate"] == 0.0


@respx.mock
async def test_error_rate_climbs_as_probes_fail(
    client: httpx.AsyncClient, target: TargetConfig
) -> None:
    respx.get(PROBE_URL).mock(return_value=httpx.Response(500))
    assembler = MetricsAssembler(probe=HttpProbe(client))

    await assembler.collect(target)
    metrics = await assembler.collect(target)

    assert metrics["availability"] == 0.0
    assert metrics["error_rate"] == 1.0
