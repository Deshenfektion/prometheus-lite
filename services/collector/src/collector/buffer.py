from __future__ import annotations

import json
import os
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from collector.logging_setup import get_logger
from collector.models import MetricSnapshot

log = get_logger("buffer")

SPOOL_SUFFIX = ".ndjson"


@dataclass(slots=True)
class DiskBuffer:
    directory: Path
    max_files: int = 200
    max_snapshots_per_file: int = 500

    def __post_init__(self) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)

    def _spool_files(self) -> list[Path]:
        return sorted(self.directory.glob(f"*{SPOOL_SUFFIX}"))

    @property
    def pending_files(self) -> int:
        return len(self._spool_files())

    def _evict_oldest(self) -> None:
        files = self._spool_files()
        while len(files) >= self.max_files:
            oldest = files.pop(0)
            oldest.unlink(missing_ok=True)
            log.warning("buffer_evicted", file=oldest.name, retained=len(files))

    def spool(self, snapshots: list[MetricSnapshot]) -> Path | None:
        if not snapshots:
            return None

        self._evict_oldest()

        handle, temporary = tempfile.mkstemp(dir=self.directory, suffix=".partial")
        try:
            with os.fdopen(handle, "w", encoding="utf-8") as stream:
                for snapshot in snapshots[: self.max_snapshots_per_file]:
                    stream.write(
                        json.dumps(snapshot.model_dump(mode="json", by_alias=True)) + "\n"
                    )
                stream.flush()
                os.fsync(stream.fileno())
        except OSError:
            Path(temporary).unlink(missing_ok=True)
            raise

        target = self.directory / f"{Path(temporary).stem}{SPOOL_SUFFIX}"
        Path(temporary).replace(target)
        log.info("batch_buffered", file=target.name, size=len(snapshots))
        return target

    def batches(self) -> Iterator[tuple[Path, list[MetricSnapshot]]]:
        for path in self._spool_files():
            try:
                lines = path.read_text(encoding="utf-8").splitlines()
            except OSError as error:
                log.error("buffer_unreadable", file=path.name, error=str(error))
                continue

            snapshots: list[MetricSnapshot] = []
            for line in lines:
                if not line.strip():
                    continue
                try:
                    snapshots.append(MetricSnapshot.model_validate_json(line))
                except ValueError:
                    log.warning("buffer_line_invalid", file=path.name)

            if not snapshots:
                path.unlink(missing_ok=True)
                continue

            yield path, snapshots

    def discard(self, path: Path) -> None:
        path.unlink(missing_ok=True)
