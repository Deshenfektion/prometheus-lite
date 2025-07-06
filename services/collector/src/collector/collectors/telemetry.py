from __future__ import annotations

from collections.abc import Mapping
from typing import Any

FIELD_ALIASES: Mapping[str, tuple[str, ...]] = {
    "cpu_percent": ("cpu_percent", "cpuPercent", "cpu", "cpu_usage", "cpuUsage"),
    "memory_percent": (
        "memory_percent",
        "memoryPercent",
        "memory",
        "memory_usage",
        "memoryUsage",
    ),
    "throughput_rps": (
        "throughput_rps",
        "throughputRps",
        "requests_per_second",
        "requestsPerSecond",
        "rps",
        "throughput",
    ),
}

NESTED_KEYS = ("metrics", "stats", "telemetry")


def _candidate_scopes(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    scopes = [payload]
    for key in NESTED_KEYS:
        nested = payload.get(key)
        if isinstance(nested, Mapping):
            scopes.append(nested)
    return scopes


def _coerce(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def extract_telemetry(payload: Mapping[str, Any] | None) -> dict[str, float]:
    if not payload:
        return {}

    scopes = _candidate_scopes(payload)
    extracted: dict[str, float] = {}

    for metric_key, aliases in FIELD_ALIASES.items():
        for scope in scopes:
            found = next((scope[alias] for alias in aliases if alias in scope), None)
            numeric = _coerce(found)
            if numeric is not None:
                extracted[metric_key] = numeric
                break

    return extracted
