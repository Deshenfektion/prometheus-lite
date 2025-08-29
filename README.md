# prometheus-lite

A small monitoring platform, built to understand how systems like Prometheus and
Grafana actually work underneath the dashboards.

The goal was never to clone Prometheus. It was to build the pieces that make a
monitoring stack work — a collector that polls targets, a storage layer shaped for
time-series data, an engine that turns thresholds into alerts, and a dashboard that
makes all of it readable — and to have to make each trade-off deliberately.

```
targets → collector → ingestion API → PostgreSQL → dashboard API → React dashboard
                                          │
                                          └→ alert engine (every 30s)
```

## What it does

- **Polls** HTTP targets on a per-target interval, concurrently, with drift correction.
- **Derives** average, p95 and p99 latency and an error rate from a rolling window, and
  reads CPU, memory and throughput from each target's health payload.
- **Ships** snapshots in batches, retries transient failures, and spools to disk when
  the API is unreachable so an outage costs nothing.
- **Stores** one row per (service, metric, instant), deduplicated by primary key so a
  retried batch cannot double-count.
- **Evaluates** threshold rules on a schedule, with sustained-breach hold-down,
  escalation, and recovery detection.
- **Flags** latency outliers with a rolling median-absolute-deviation score.
- **Serves** a dashboard: fleet overview, per-service trends, alert history, filters,
  configurable auto-refresh — behind JWT auth with `USER` and `ADMIN` roles.

## Components

| Component | Stack                                 | Responsibility                  |
| --------- | ------------------------------------- | ------------------------------- |
| Collector | Python 3.13, asyncio, httpx, pydantic | Poll targets, produce snapshots |
| API       | TypeScript, Express, Postgres, zod    | Ingest, query, evaluate alerts  |
| Storage   | PostgreSQL 17                         | Snapshots, rules, alert state   |
| Dashboard | React 19, Vite, Tailwind 4, Recharts  | Visualise health and trends     |

## Running the whole thing

```bash
cp .env.example .env      # set JWT_SECRET and INGEST_TOKEN
make up
```

That builds five images and starts Postgres, the API, the collector, the dashboard and
three synthetic target services. Migrations run at API startup and the monitored
targets are registered before the collector begins, so a cold start produces data
immediately.

Create a user and open the dashboard:

```bash
make admin EMAIL=you@example.com PASSWORD='a-long-enough-password'
open http://localhost:8080
```

`make logs` follows everything; `make down` stops it and drops the volumes.

## Running the pieces directly

Postgres:

```bash
docker run -d --name plite-pg \
  -e POSTGRES_USER=prometheus_lite -e POSTGRES_PASSWORD=prometheus_lite \
  -e POSTGRES_DB=prometheus_lite -p 5432:5432 postgres:17-alpine
```

API and dashboard:

```bash
npm install
npm run migrate --workspace services/api
npm run seed --workspace services/api     # demo services + 2h of history + default rules
npm run api                               # http://localhost:4000
npm run web                               # http://localhost:5173
```

Collector:

```bash
cd services/collector
python3.13 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
cp collector.example.yaml collector.yaml
python -m collector
```

## The time-series model

One row per (service, metric, instant):

```sql
metric_snapshots (service_id, metric_id, recorded_at, value)
PRIMARY KEY (service_id, metric_id, recorded_at)
```

Narrow rows rather than a wide row per poll, so adding a metric is an `INSERT` into a
catalogue table rather than a schema migration. The key ordering matches the shape of
every dashboard query — equality on service and metric, range on time — so those are
index range scans. The same key is the deduplication key, which is what makes collector
retries safe.

Writes use `UNNEST` array parameters rather than one statement per row: about twenty
times faster, and the parameter count stays fixed at four regardless of batch size.
Reads aggregate into time buckets in Postgres, with the bucket size chosen from the
window and a point budget.

Details and measurements: [docs/time-series-model.md](docs/time-series-model.md).

## The alert engine

A rule asks one question of one metric: over the last `window_seconds`, is the
`avg`/`max`/`min`/`last` of this metric above or below a threshold, and has it stayed
that way for `for_seconds`?

Escalations wait out the hold-down; recoveries are immediate, because a hold-down
exists to suppress noise, not to delay good news. Transitions go to an append-only
event log with at most one open incident per (rule, service), enforced by a partial
unique index.

Details, including the threshold bug that made every healthy service warn:
[docs/alerting.md](docs/alerting.md).

## Outlier detection

Each point is scored against a rolling window of the points before it. The default is a
modified z-score built on the median and median absolute deviation rather than mean and
standard deviation, because the mean is dragged toward the very spikes being looked
for — one 4-second outlier entering the baseline drops the next one's score from ~2700
to ~5.6. No training, no model, no dependencies.

## Authentication

JWT with `USER` and `ADMIN` roles. Reads are open to any signed-in user; writes to
services and alert rules require `ADMIN`. The collector uses a separate static token
scoped to the ingestion route only — a user token is rejected there and the collector
token is rejected everywhere else.

## Testing

```bash
make test      # everything
```

or individually:

```bash
npm test --workspace services/api    # 123 tests, vitest + supertest
npm test --workspace web             # 40 tests, vitest + testing-library
cd services/collector && pytest      # 69 tests
```

API integration tests need a reachable `DATABASE_URL` and skip themselves when there
isn't one, so the unit suites still run on a bare checkout. The collector and dashboard
suites need nothing external.

The tests worth reading are the ones covering decisions rather than plumbing: the alert
state machine's hold-down and recovery paths, the half-open evaluation window, the
robust-vs-plain outlier scoring, and ingestion's partial-acceptance behaviour.

## Performance

Measured on a laptop, not a server — the ratios matter more than the absolutes:

| Thing                                   | Result                   |
| --------------------------------------- | ------------------------ |
| Batched insert vs row-by-row            | ~33,000 vs ~1,700 rows/s |
| Ingestion, 200-snapshot batches         | p50 39 ms, p95 45 ms     |
| Latest-value-per-series, before → after | 15.4 ms → 0.197 ms       |
| Dashboard summary, cache miss → hit     | 13 ms → ~0.9 ms          |
| Alert evaluation, 5 rules × 4 services  | 46 ms                    |

Full method, query plans, and the index that made another query _worse_:
[docs/performance.md](docs/performance.md).

## Documentation

- [Architecture](docs/architecture.md) — boundaries, layering, caching, what is unsolved
- [Time-series model](docs/time-series-model.md) — schema decisions and write path
- [Alert engine](docs/alerting.md) — rules, state machine, incidents
- [Performance](docs/performance.md) — measurements and the reasoning behind them
- [HTTP API](docs/api.md) — every endpoint and its contract

## Future improvements

- **Notification delivery.** The engine decides state and stops. Routing, grouping,
  inhibition and silences are a separate system and were deliberately left out rather
  than half-built.
- **Materialised rollups.** Aggregation happens on read, which is fine at this volume.
  The retention job already walks the same rows, so it is the natural place to write
  hourly and daily rollups when reads outgrow it.
- **Table partitioning.** Monthly partitions on `recorded_at` would turn retention from
  a chunked `DELETE` into a `DROP TABLE`.
- **Multiple collectors.** Two collectors polling the same target would race on the
  deduplication key rather than coordinate. Ownership needs leases or sharding.
- **PromQL-ish query language.** Rules are currently a row of columns. An expression
  language would allow ratios between metrics, which thresholds on a single series
  cannot express.
- **Refresh tokens.** Access tokens live an hour and logout is client-side. Anything
  longer needs revocation, and revocation needs a store.
