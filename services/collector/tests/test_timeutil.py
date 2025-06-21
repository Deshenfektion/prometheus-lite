from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

from collector.models import MetricSnapshot
from collector.timeutil import normalize, to_utc, truncate_to_milliseconds, utc_now


def test_utc_now_is_timezone_aware() -> None:
    assert utc_now().tzinfo == UTC


def test_naive_timestamps_are_treated_as_utc() -> None:
    naive = datetime(2025, 2, 2, 12, 30, 0)
    assert to_utc(naive) == datetime(2025, 2, 2, 12, 30, 0, tzinfo=UTC)


def test_offset_timestamps_are_converted_not_relabelled() -> None:
    berlin = timezone(timedelta(hours=1))
    local = datetime(2025, 2, 2, 12, 30, 0, tzinfo=berlin)
    assert to_utc(local) == datetime(2025, 2, 2, 11, 30, 0, tzinfo=UTC)


def test_microseconds_are_truncated_to_milliseconds() -> None:
    value = datetime(2025, 2, 2, 12, 30, 0, 123_456, tzinfo=UTC)
    assert truncate_to_milliseconds(value).microsecond == 123_000


def test_normalize_combines_conversion_and_truncation() -> None:
    berlin = timezone(timedelta(hours=1))
    value = datetime(2025, 2, 2, 12, 30, 0, 999_999, tzinfo=berlin)
    assert normalize(value) == datetime(2025, 2, 2, 11, 30, 0, 999_000, tzinfo=UTC)


def test_snapshot_normalizes_on_construction() -> None:
    snapshot = MetricSnapshot(
        service="checkout-api",
        recorded_at=datetime(2025, 2, 2, 12, 30, 0, 654_321),
        metrics={"availability": 1.0},
    )
    assert snapshot.recorded_at == datetime(2025, 2, 2, 12, 30, 0, 654_000, tzinfo=UTC)


def test_serialized_timestamp_round_trips_through_json() -> None:
    snapshot = MetricSnapshot(
        service="checkout-api",
        recorded_at=datetime(2025, 2, 2, 12, 30, 0, 654_321, tzinfo=UTC),
        metrics={"availability": 1.0},
    )
    payload = snapshot.model_dump(mode="json", by_alias=True)
    assert payload["recordedAt"].startswith("2025-02-02T12:30:00.654")
    assert MetricSnapshot.model_validate(payload).recorded_at == snapshot.recorded_at
