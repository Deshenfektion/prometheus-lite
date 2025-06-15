from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio

from collector.config import TargetConfig


@pytest.fixture
def target() -> TargetConfig:
    return TargetConfig(
        slug="checkout-api",
        display_name="Checkout API",
        base_url="http://checkout.test",
        health_path="/health",
        interval_seconds=1.0,
        timeout_ms=500,
    )


@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient() as instance:
        yield instance
