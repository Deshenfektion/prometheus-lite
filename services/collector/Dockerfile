FROM python:3.13-slim AS build

WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1

COPY services/collector/pyproject.toml ./
COPY services/collector/src ./src
COPY services/collector/README.md ./

RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install .

FROM python:3.13-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
RUN useradd --create-home --shell /usr/sbin/nologin collector

COPY --from=build /opt/venv /opt/venv
COPY services/collector/collector.example.yaml /app/collector.yaml

USER collector
CMD ["python", "-m", "collector"]
