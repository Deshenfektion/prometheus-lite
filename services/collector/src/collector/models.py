from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

MetricKey = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{1,62}$")]


def _to_camel(field_name: str) -> str:
    head, *tail = field_name.split("_")
    return head + "".join(part.capitalize() for part in tail)


class WireModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
        frozen=True,
    )


class MetricSnapshot(WireModel):
    service: str
    recorded_at: datetime
    metrics: dict[MetricKey, float]

    @field_validator("recorded_at")
    @classmethod
    def ensure_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class SnapshotBatch(WireModel):
    collector: str
    snapshots: list[MetricSnapshot]


class ProbeOutcome(WireModel):
    service: str
    reachable: bool
    status_code: int | None
    latency_ms: float
    error: str | None = None
