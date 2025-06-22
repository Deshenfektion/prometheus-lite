from __future__ import annotations

import math

import pytest

from collector.validators import BOUNDS, validate_metrics


def test_valid_metrics_pass_through_unchanged() -> None:
    metrics = {"availability": 1.0, "latency_ms": 42.5, "cpu_percent": 12.0}
    assert validate_metrics("checkout-api", metrics) == metrics


def test_unknown_metric_keys_are_dropped() -> None:
    accepted = validate_metrics("checkout-api", {"availability": 1.0, "gpu_temp": 60.0})
    assert accepted == {"availability": 1.0}


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("availability", 0.5),
        ("http_status", 42.0),
        ("http_status", 200.5),
        ("cpu_percent", 145.0),
        ("cpu_percent", -1.0),
        ("error_rate", 1.5),
        ("latency_ms", -3.0),
        ("throughput_rps", math.inf),
    ],
)
def test_out_of_range_values_are_dropped(key: str, value: float) -> None:
    assert validate_metrics("checkout-api", {key: value}) == {}


def test_integers_are_normalised_to_floats() -> None:
    accepted = validate_metrics("checkout-api", {"http_status": 200})
    assert accepted == {"http_status": 200.0}
    assert isinstance(accepted["http_status"], float)


def test_every_bound_accepts_its_own_limits() -> None:
    for key, bounds in BOUNDS.items():
        assert bounds.check(bounds.minimum) is None
        assert bounds.check(bounds.maximum) is None
        assert validate_metrics("checkout-api", {key: bounds.maximum}) != {}
