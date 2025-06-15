from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from collector.config import TargetConfig, load_targets


def write_config(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "collector.yaml"
    path.write_text(body, encoding="utf-8")
    return path


def test_probe_url_joins_base_and_path() -> None:
    target = TargetConfig(
        slug="search-api",
        display_name="Search API",
        base_url="http://search.test/",
        health_path="/healthz",
    )
    assert target.probe_url == "http://search.test/healthz"


def test_defaults_are_applied() -> None:
    target = TargetConfig(
        slug="search-api", display_name="Search API", base_url="http://search.test"
    )
    assert target.health_path == "/health"
    assert target.interval_seconds == 15.0
    assert target.timeout_ms == 3000
    assert target.enabled is True


def test_invalid_slug_is_rejected() -> None:
    with pytest.raises(ValidationError):
        TargetConfig(slug="Search API", display_name="Search API", base_url="http://search.test")


def test_load_targets_skips_disabled_entries(tmp_path: Path) -> None:
    path = write_config(
        tmp_path,
        """
targets:
  - slug: checkout-api
    display_name: Checkout API
    base_url: http://checkout.test
  - slug: search-api
    display_name: Search API
    base_url: http://search.test
    enabled: false
""",
    )
    targets = load_targets(path)
    assert [target.slug for target in targets] == ["checkout-api"]


def test_load_targets_rejects_duplicate_slugs(tmp_path: Path) -> None:
    path = write_config(
        tmp_path,
        """
targets:
  - slug: checkout-api
    display_name: Checkout API
    base_url: http://checkout.test
  - slug: checkout-api
    display_name: Checkout API (copy)
    base_url: http://checkout-2.test
""",
    )
    with pytest.raises(ValueError, match="duplicate target slugs"):
        load_targets(path)


def test_missing_config_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_targets(tmp_path / "absent.yaml")
