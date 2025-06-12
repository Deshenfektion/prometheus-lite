from __future__ import annotations

import sys

from collector.config import CollectorSettings, load_targets
from collector.logging_setup import configure_logging, get_logger


def main() -> int:
    settings = CollectorSettings()
    configure_logging(settings.log_level, settings.log_json)
    log = get_logger("collector")

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
    for target in targets:
        log.info("target_registered", slug=target.slug, url=target.probe_url)

    return 0


if __name__ == "__main__":
    sys.exit(main())
