# prometheus-lite

A small monitoring platform, built to understand how systems like Prometheus and
Grafana actually work underneath the dashboards.

The goal is not to clone Prometheus. The goal is to build the pieces that make a
monitoring stack work — a collector that polls targets, a storage layer shaped for
time-series data, an engine that turns thresholds into alerts, and a dashboard that
makes all of it readable — and to understand the trade-offs in each.

## Components

| Component | Stack                         | Responsibility                                        |
| --------- | ----------------------------- | ----------------------------------------------------- |
| Collector | Python 3.13, httpx, asyncio   | Poll targets on an interval, produce metric snapshots |
| API       | TypeScript, Express, Postgres | Ingest snapshots, serve queries, evaluate alerts      |
| Storage   | PostgreSQL 17                 | Time-series snapshots, rules, alert history           |
| Dashboard | React, Vite, Tailwind         | Visualise service health and trends                   |

## Pipeline

```
targets → collector → ingestion API → PostgreSQL → dashboard API → React dashboard
                                          │
                                          └→ alert engine
```

The collector pulls from targets and pushes to the API. Each poll becomes a snapshot:
a service, a timestamp, and a map of metric values. The API validates it, normalises
the timestamp, fans it out to one row per metric, and writes the batch.

## Storage

One row per (service, metric, instant):

```sql
metric_snapshots (service_id, metric_id, recorded_at, value)
PRIMARY KEY (service_id, metric_id, recorded_at)
```

The primary key doubles as the deduplication key, so a collector that retries a batch
whose response was lost cannot create duplicate points. See
[docs/time-series-model.md](docs/time-series-model.md) for why the rows are narrow, why
the key is ordered that way, and what batching bought.

## Running locally

Postgres:

```bash
docker run -d --name plite-pg \
  -e POSTGRES_USER=prometheus_lite \
  -e POSTGRES_PASSWORD=prometheus_lite \
  -e POSTGRES_DB=prometheus_lite \
  -p 5432:5432 postgres:17-alpine
```

API:

```bash
cp .env.example .env
npm install
npm run migrate --workspace services/api
npm run api
```

Collector:

```bash
cd services/collector
python3.13 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
cp collector.example.yaml collector.yaml
python -m collector
```

## Testing

```bash
npm test --workspace services/api     # vitest, needs DATABASE_URL for the integration suite
cd services/collector && pytest       # pytest, no external dependencies
```

The API integration tests skip themselves when no database is reachable, so the unit
suites still run on a bare checkout.

## API

| Method   | Path                       | Purpose                            |
| -------- | -------------------------- | ---------------------------------- |
| `GET`    | `/health`                  | Liveness and database reachability |
| `GET`    | `/api/v1/services`         | List registered services           |
| `POST`   | `/api/v1/services`         | Register a service                 |
| `GET`    | `/api/v1/services/:slug`   | Fetch one service                  |
| `PATCH`  | `/api/v1/services/:slug`   | Update a service                   |
| `DELETE` | `/api/v1/services/:slug`   | Remove a service and its snapshots |
| `POST`   | `/api/v1/ingest/snapshots` | Submit a batch of metric snapshots |

## Documentation

- [Architecture](docs/architecture.md)
- [Time-series model](docs/time-series-model.md)

## Status

Ingestion path works end to end: the collector polls, batches, and ships; the API
validates and stores. Next: query endpoints and the dashboard.
