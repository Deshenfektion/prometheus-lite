from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
import respx

from collector.models import MetricSnapshot
from collector.shipper import SnapshotShipper

ENDPOINT = "http://api.test/api/v1/ingest/snapshots"


def snapshot(service: str = "checkout-api", offset: int = 0) -> MetricSnapshot:
    return MetricSnapshot(
        service=service,
        recorded_at=datetime(2025, 5, 13, 10, 0, offset, tzinfo=UTC),
        metrics={"availability": 1.0, "latency_ms": 42.0},
    )


def make_shipper(client: httpx.AsyncClient, buffer_dir: Path | None = None) -> SnapshotShipper:
    return SnapshotShipper(
        client=client,
        api_base_url="http://api.test",
        collector_name="collector-1",
        api_token="test-token",
        max_attempts=2,
        buffer_dir=buffer_dir,
    )


@respx.mock
async def test_successful_send_reports_stats(client: httpx.AsyncClient) -> None:
    route = respx.post(ENDPOINT).mock(
        return_value=httpx.Response(202, json={"data": {"storedPoints": 4, "rejected": []}})
    )
    shipper = make_shipper(client)

    assert await shipper.send([snapshot(), snapshot(offset=1)]) is True
    assert shipper.stats.batches_sent == 1
    assert shipper.stats.snapshots_sent == 2
    assert route.called


@respx.mock
async def test_batch_carries_the_collector_token(client: httpx.AsyncClient) -> None:
    route = respx.post(ENDPOINT).mock(return_value=httpx.Response(202, json={"data": {}}))
    shipper = make_shipper(client)

    await shipper.send([snapshot()])

    assert route.calls.last.request.headers["authorization"] == "Bearer test-token"


@respx.mock
async def test_transient_failure_is_retried(client: httpx.AsyncClient) -> None:
    route = respx.post(ENDPOINT).mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(202, json={"data": {"storedPoints": 2}}),
        ]
    )
    shipper = make_shipper(client)

    assert await shipper.send([snapshot()]) is True
    assert route.call_count == 2


@respx.mock
async def test_rejected_batch_is_not_retried(client: httpx.AsyncClient) -> None:
    route = respx.post(ENDPOINT).mock(return_value=httpx.Response(400, text="bad payload"))
    shipper = make_shipper(client)

    assert await shipper.send([snapshot()]) is False
    assert route.call_count == 1
    assert shipper.stats.snapshots_dropped == 1


@respx.mock
async def test_snapshots_are_buffered_when_the_api_is_unreachable(
    client: httpx.AsyncClient, tmp_path: Path
) -> None:
    respx.post(ENDPOINT).mock(side_effect=httpx.ConnectError("refused"))
    shipper = make_shipper(client, buffer_dir=tmp_path)

    assert await shipper.send([snapshot(), snapshot(offset=1)]) is False
    assert shipper.stats.snapshots_buffered == 2
    assert shipper.buffer is not None
    assert shipper.buffer.pending_files == 1


@respx.mock
async def test_buffered_snapshots_are_replayed_once_the_api_returns(
    client: httpx.AsyncClient, tmp_path: Path
) -> None:
    respx.post(ENDPOINT).mock(side_effect=httpx.ConnectError("refused"))
    shipper = make_shipper(client, buffer_dir=tmp_path)
    await shipper.send([snapshot(), snapshot(offset=1)])

    respx.post(ENDPOINT).mock(return_value=httpx.Response(202, json={"data": {}}))

    assert await shipper.replay_buffer() == 2
    assert shipper.buffer is not None
    assert shipper.buffer.pending_files == 0
    assert shipper.stats.snapshots_replayed == 2


@respx.mock
async def test_replay_stops_while_the_api_is_still_down(
    client: httpx.AsyncClient, tmp_path: Path
) -> None:
    respx.post(ENDPOINT).mock(side_effect=httpx.ConnectError("refused"))
    shipper = make_shipper(client, buffer_dir=tmp_path)
    await shipper.send([snapshot()])

    assert await shipper.replay_buffer() == 0
    assert shipper.buffer is not None
    assert shipper.buffer.pending_files == 1


@respx.mock
async def test_replayed_snapshots_survive_a_round_trip_through_disk(
    client: httpx.AsyncClient, tmp_path: Path
) -> None:
    respx.post(ENDPOINT).mock(side_effect=httpx.ConnectError("refused"))
    shipper = make_shipper(client, buffer_dir=tmp_path)
    original = snapshot()
    await shipper.send([original])

    assert shipper.buffer is not None
    _, restored = next(iter(shipper.buffer.batches()))

    assert restored[0] == original


async def test_without_a_buffer_failed_batches_are_dropped(client: httpx.AsyncClient) -> None:
    with respx.mock:
        respx.post(ENDPOINT).mock(side_effect=httpx.ConnectError("refused"))
        shipper = make_shipper(client)

        await shipper.send([snapshot()])

        assert shipper.stats.snapshots_dropped == 1
        assert shipper.buffer is None


@respx.mock
async def test_the_buffer_evicts_the_oldest_batches(
    client: httpx.AsyncClient, tmp_path: Path
) -> None:
    respx.post(ENDPOINT).mock(side_effect=httpx.ConnectError("refused"))
    shipper = make_shipper(client, buffer_dir=tmp_path)
    assert shipper.buffer is not None
    shipper.buffer.max_files = 3

    for index in range(6):
        await shipper.send([snapshot(offset=index)])

    assert shipper.buffer.pending_files <= 3


@pytest.mark.parametrize("status", [500, 502, 503, 504])
@respx.mock
async def test_server_errors_are_treated_as_transient(
    client: httpx.AsyncClient, tmp_path: Path, status: int
) -> None:
    respx.post(ENDPOINT).mock(return_value=httpx.Response(status))
    shipper = make_shipper(client, buffer_dir=tmp_path)

    assert await shipper.send([snapshot()]) is False
    assert shipper.stats.snapshots_buffered == 1
