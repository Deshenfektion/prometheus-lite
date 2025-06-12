# Collector

Polls monitored targets on a configurable interval, turns each poll into a metric
snapshot, and ships snapshots to the ingestion API.

## Local setup

```bash
cd services/collector
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp collector.example.yaml collector.yaml
python -m collector
```

## Configuration

Targets are declared in `collector.yaml`. Runtime settings come from the environment
with the `COLLECTOR_` prefix, for example `COLLECTOR_API_BASE_URL` or
`COLLECTOR_LOG_LEVEL`.

## Tests

```bash
pytest
```
