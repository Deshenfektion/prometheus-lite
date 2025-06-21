from __future__ import annotations

import asyncio
import sys

import httpx

from collector.collectors import HttpProbe
from collector.config import CollectorSettings, TargetConfig, load_targets
from collector.logging_setup import configure_logging, get_logger
from collector.scheduler import PollScheduler
from collector.shipper import SnapshotShipper

log = get_logger("collector")


async def run(settings: CollectorSettings, targets: list[TargetConfig]) -> None:
    limits = httpx.Limits(max_connections=64, max_keepalive_connections=32)
    async with httpx.AsyncClient(
        limits=limits,
        timeout=settings.request_timeout_seconds,
        follow_redirects=False,
        headers={"user-agent": f"prometheus-lite-collector/{settings.name}"},
    ) as client:
        shipper = SnapshotShipper(
            client=client,
            api_base_url=settings.api_base_url,
            collector_name=settings.name,
            max_batch_size=settings.batch_max_size,
            max_wait_seconds=settings.batch_max_wait_seconds,
            max_queue_size=settings.queue_max_size,
            max_attempts=settings.send_max_attempts,
        )
        scheduler = PollScheduler(
            targets=targets,
            collect=HttpProbe(client).collect,
            sink=shipper.submit,
        )

        async with asyncio.TaskGroup() as group:
            group.create_task(shipper.run(), name="shipper")
            group.create_task(scheduler.run(), name="scheduler")


def main() -> int:
    settings = CollectorSettings()
    configure_logging(settings.log_level, settings.log_json)

    try:
        targets = load_targets(settings.config_file)
    except (FileNotFoundError, ValueError) as error:
        log.error("configuration_invalid", error=str(error))
        return 1

    log.info(
        "collector_configured",
        collector=settings.name,
        api=settings.api_base_url,
        targets=len(targets),
    )

    try:
        asyncio.run(run(settings, targets))
    except KeyboardInterrupt:
        log.info("collector_stopped")

    return 0


if __name__ == "__main__":
    sys.exit(main())
