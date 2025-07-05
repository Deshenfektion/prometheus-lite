from __future__ import annotations

import pytest

from collector.aggregation import MIN_SAMPLES_FOR_PERCENTILES, RollingWindow, percentile


def test_nearest_rank_percentile_matches_hand_calculation() -> None:
    values = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]
    assert percentile(values, 0.5) == 50.0
    assert percentile(values, 0.95) == 100.0
    assert percentile(values, 0.9) == 90.0
    assert percentile(values, 1.0) == 100.0


def test_percentile_is_order_independent() -> None:
    assert percentile([70.0, 10.0, 30.0, 90.0, 50.0], 0.6) == 50.0


def test_percentile_rejects_invalid_input() -> None:
    with pytest.raises(ValueError):
        percentile([], 0.5)
    with pytest.raises(ValueError):
        percentile([1.0], 0.0)
    with pytest.raises(ValueError):
        percentile([1.0], 1.5)


def test_window_reports_average_and_error_rate() -> None:
    window = RollingWindow()
    window.add(10.0, available=True, now=0.0)
    window.add(20.0, available=True, now=1.0)
    window.add(30.0, available=False, now=2.0)
    window.add(40.0, available=True, now=3.0)

    summary = window.summary()

    assert summary["latency_avg_ms"] == 25.0
    assert summary["error_rate"] == 0.25


def test_percentiles_are_withheld_until_the_window_is_meaningful() -> None:
    window = RollingWindow()
    for index in range(MIN_SAMPLES_FOR_PERCENTILES - 1):
        window.add(float(index), available=True, now=float(index))

    assert "latency_p95_ms" not in window.summary()

    window.add(99.0, available=True, now=99.0)
    summary = window.summary()

    assert "latency_p95_ms" in summary
    assert "latency_p99_ms" in summary


def test_window_drops_samples_older_than_the_max_age() -> None:
    window = RollingWindow(max_age_seconds=10.0)
    window.add(1000.0, available=True, now=0.0)
    for index in range(1, 6):
        window.add(10.0, available=True, now=float(index))

    assert len(window) == 6

    window.add(10.0, available=True, now=11.0)

    assert len(window) == 6
    assert 1000.0 not in window.latencies()


def test_window_is_bounded_by_max_samples() -> None:
    window = RollingWindow(max_samples=3, max_age_seconds=1000.0)
    for index in range(10):
        window.add(float(index), available=True, now=float(index))

    assert len(window) == 3
    assert window.latencies() == [7.0, 8.0, 9.0]


def test_a_single_outlier_in_a_hundred_samples_does_not_reach_p99() -> None:
    window = RollingWindow()
    for index in range(99):
        window.add(20.0, available=True, now=float(index))
    window.add(5000.0, available=True, now=99.0)

    summary = window.summary()

    assert summary["latency_avg_ms"] < 100
    assert summary["latency_p95_ms"] == 20.0
    assert summary["latency_p99_ms"] == 20.0
    assert max(window.latencies()) == 5000.0


def test_sustained_spikes_lift_p99_before_p95() -> None:
    window = RollingWindow()
    for index in range(95):
        window.add(20.0, available=True, now=float(index))
    for index in range(95, 100):
        window.add(5000.0, available=True, now=float(index))

    summary = window.summary()

    assert summary["latency_p95_ms"] == 20.0
    assert summary["latency_p99_ms"] == 5000.0
