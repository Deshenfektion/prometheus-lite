from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class TargetConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,62}$")
    display_name: str
    base_url: HttpUrl
    health_path: str = "/health"
    environment: str = "production"
    interval_seconds: float = Field(default=15.0, gt=0, le=3600)
    timeout_ms: int = Field(default=3000, ge=100, le=60_000)
    enabled: bool = True

    @property
    def probe_url(self) -> str:
        return f"{str(self.base_url).rstrip('/')}{self.health_path}"


class CollectorSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="COLLECTOR_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    name: str = "collector-1"
    api_base_url: str = "http://localhost:4000"
    api_token: str = ""
    config_file: Path = Path("collector.yaml")
    default_interval_seconds: float = Field(default=15.0, gt=0)
    request_timeout_seconds: float = Field(default=5.0, gt=0)
    batch_max_size: int = Field(default=200, ge=1, le=500)
    batch_max_wait_seconds: float = Field(default=2.0, gt=0)
    queue_max_size: int = Field(default=10_000, ge=100)
    send_max_attempts: int = Field(default=4, ge=1, le=10)
    window_max_samples: int = Field(default=120, ge=2, le=10_000)
    window_max_age_seconds: float = Field(default=300.0, gt=0)
    self_service_slug: str = ""
    self_interval_seconds: float = Field(default=15.0, gt=0)
    log_level: str = "info"
    log_json: bool = False


def load_targets(path: Path) -> list[TargetConfig]:
    if not path.exists():
        raise FileNotFoundError(f"collector config not found: {path}")

    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    entries = raw.get("targets", [])
    if not isinstance(entries, list):
        raise ValueError("'targets' must be a list")

    targets = [TargetConfig.model_validate(entry) for entry in entries]
    slugs = [target.slug for target in targets]
    duplicates = {slug for slug in slugs if slugs.count(slug) > 1}
    if duplicates:
        raise ValueError(f"duplicate target slugs: {', '.join(sorted(duplicates))}")

    return [target for target in targets if target.enabled]
