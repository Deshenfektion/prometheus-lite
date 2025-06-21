from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from collector.timeutil import normalize

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
        return normalize(value)


class SnapshotBatch(WireModel):
    collector: str
    snapshots: list[MetricSnapshot]


@dataclass(frozen=True, slots=True)
class ProbeOutcome:
    service: str
    reachable: bool
    status_code: int | None
    latency_ms: float
    payload: Mapping[str, Any] | None = None
    error: str | None = None

    @property
    def healthy(self) -> bool:
        return self.reachable and self.status_code is not None and 200 <= self.status_code < 400
