from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import httpx
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from collector.logging_setup import get_logger
from collector.models import MetricSnapshot, SnapshotBatch

log = get_logger("shipper")

INGEST_PATH = "/api/v1/ingest/snapshots"


class TransientIngestError(Exception):
    pass


class PermanentIngestError(Exception):
    pass


@dataclass(slots=True)
class ShipperStats:
    batches_sent: int = 0
    snapshots_sent: int = 0
    snapshots_dropped: int = 0
    send_failures: int = 0


@dataclass(slots=True)
class SnapshotShipper:
    client: httpx.AsyncClient
    api_base_url: str
    collector_name: str
    max_batch_size: int = 200
    max_wait_seconds: float = 2.0
    max_queue_size: int = 10_000
    max_attempts: int = 4
    stats: ShipperStats = field(default_factory=ShipperStats)
    _queue: asyncio.Queue[MetricSnapshot] = field(init=False)

    def __post_init__(self) -> None:
        self._queue = asyncio.Queue(maxsize=self.max_queue_size)

    @property
    def endpoint(self) -> str:
        return f"{self.api_base_url.rstrip('/')}{INGEST_PATH}"

    @property
    def pending(self) -> int:
        return self._queue.qsize()

    async def submit(self, snapshot: MetricSnapshot) -> None:
        try:
            self._queue.put_nowait(snapshot)
        except asyncio.QueueFull:
            self.stats.snapshots_dropped += 1
            log.warning(
                "queue_full",
                service=snapshot.service,
                dropped=self.stats.snapshots_dropped,
            )

    async def _next_batch(self) -> list[MetricSnapshot]:
        first = await self._queue.get()
        batch = [first]
        loop = asyncio.get_running_loop()
        deadline = loop.time() + self.max_wait_seconds

        while len(batch) < self.max_batch_size:
            remaining = deadline - loop.time()
            if remaining <= 0:
                break
            try:
                batch.append(await asyncio.wait_for(self._queue.get(), timeout=remaining))
            except TimeoutError:
                break

        return batch

    async def _post(self, batch: SnapshotBatch) -> dict[str, Any]:
        try:
            response = await self.client.post(
                self.endpoint,
                json=batch.model_dump(mode="json", by_alias=True),
            )
        except httpx.HTTPError as error:
            raise TransientIngestError(str(error)) from error

        if response.status_code >= 500:
            raise TransientIngestError(f"ingestion api returned {response.status_code}")
        if response.status_code >= 400:
            raise PermanentIngestError(
                f"ingestion api rejected batch with {response.status_code}: {response.text[:200]}"
            )

        body = response.json()
        return body.get("data", {}) if isinstance(body, dict) else {}

    async def send(self, snapshots: list[MetricSnapshot]) -> bool:
        batch = SnapshotBatch(collector=self.collector_name, snapshots=snapshots)

        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self.max_attempts),
                wait=wait_exponential_jitter(initial=0.5, max=8.0),
                retry=retry_if_exception_type(TransientIngestError),
                reraise=True,
            ):
                with attempt:
                    result = await self._post(batch)
        except (TransientIngestError, RetryError) as error:
            self.stats.send_failures += 1
            log.error("batch_send_failed", size=len(snapshots), error=str(error))
            return False
        except PermanentIngestError as error:
            self.stats.send_failures += 1
            self.stats.snapshots_dropped += len(snapshots)
            log.error("batch_rejected", size=len(snapshots), error=str(error))
            return False

        self.stats.batches_sent += 1
        self.stats.snapshots_sent += len(snapshots)

        rejected = result.get("rejected") or []
        if rejected:
            log.warning("snapshots_rejected", count=len(rejected), details=rejected[:5])

        log.debug(
            "batch_sent",
            size=len(snapshots),
            stored_points=result.get("storedPoints"),
        )
        return True

    async def run(self) -> None:
        log.info("shipper_started", endpoint=self.endpoint, max_batch_size=self.max_batch_size)
        while True:
            batch = await self._next_batch()
            await self.send(batch)
