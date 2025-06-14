from __future__ import annotations

import asyncio
import sys

import httpx

from collector.collectors import HttpProbe
from collector.config import CollectorSettings, TargetConfig, load_targets
from collector.logging_setup import configure_logging, get_logger
from collector.models import MetricSnapshot
from collector.scheduler import PollScheduler

log = get_logger("collector")


async def _log_snapshot(snapshot: MetricSnapshot) -> None:
    log.info(
        "snapshot",
        service=snapshot.service,
        recorded_at=snapshot.recorded_at.isoformat(),
        metrics=snapshot.metrics,
    )


async def run(settings: CollectorSettings, targets: list[TargetConfig]) -> None:
    limits = httpx.Limits(max_connections=64, max_keepalive_connections=32)
    async with httpx.AsyncClient(
        limits=limits,
        timeout=settings.request_timeout_seconds,
        follow_redirects=False,
        headers={"user-agent": f"prometheus-lite-collector/{settings.name}"},
    ) as client:
        scheduler = PollScheduler(
            targets=targets,
            collect=HttpProbe(client).collect,
            sink=_log_snapshot,
        )
        await scheduler.run()


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
