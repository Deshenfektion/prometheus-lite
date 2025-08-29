# Architecture

## Why build this

Prometheus makes a set of choices that are easy to use and hard to see: a pull-based
collector, a storage engine tuned for append-heavy workloads, a rule evaluator that
runs on a fixed interval, and a query layer that everything else is built on. Reading
about those choices is not the same as making them.

This project rebuilds a small version of that pipeline so each choice has to be made
explicitly.

## Pipeline

```
      target services (HTTP)
               │  poll
               ▼
     ┌───────────────────┐
     │  Python collector │   probes targets, samples resources,
     │  (scheduler)      │   keeps rolling windows, builds snapshots
     └─────────┬─────────┘
               │  batched HTTP POST, bearer token
               ▼
     ┌───────────────────┐
     │  Ingestion API    │   validate → normalise → fan out → batch insert
     └─────────┬─────────┘
               ▼
     ┌───────────────────┐
     │   PostgreSQL      │   time-series snapshots, rules, alert state
     └─────────┬─────────┘
               │
        ┌──────┴───────┐
        ▼              ▼
  ┌───────────┐  ┌────────────┐
  │  Alert    │  │ Dashboard  │
  │  engine   │─▶│    API     │
  └───────────┘  └──────┬─────┘
   every 30s            │ JWT
                        ▼
                ┌───────────────┐
                │ React         │
                │ dashboard     │
                └───────────────┘
```

## Component boundaries

The collector knows nothing about storage. It produces snapshots and posts them.
The API knows nothing about how snapshots were produced. It validates, stores, and
queries them. The dashboard knows nothing about the database. It reads the API.

Every boundary is an HTTP or SQL contract, which is what makes the pieces
independently testable — the collector suite runs with no database, the API suite runs
with no collector, and the dashboard suite runs with neither.

## Pull vs push

Prometheus pulls: the server scrapes targets it knows about. That makes target
discovery the server's problem and gives the server control over cadence.

Here the collector pulls from targets and pushes to the API. The collector owns the
polling schedule; the API only sees a stream of finished snapshots. This splits the
system at a place where the two halves can be written in different languages, which
is the point — the collector is Python because probing and sampling is what Python is
comfortable with, and the API is TypeScript because that is where the type-driven
query and alert logic lives.

The cost is that the API cannot tell "target is down" from "collector is down". The
dashboard closes that gap from the other side: a service whose newest snapshot is
older than six poll intervals is reported as `UNKNOWN` rather than healthy. Silence is
never treated as good news.

## Two kinds of credential

The dashboard and the collector are different sorts of client, so they authenticate
differently:

| Client         | Credential                     | Scope                       |
| -------------- | ------------------------------ | --------------------------- |
| Dashboard user | JWT, 1 hour, `USER` or `ADMIN` | everything except `/ingest` |
| Collector      | Static bearer token            | `/ingest` only              |

A collector holding a user's JWT would be a collector that can delete services. A user
token is explicitly rejected on the ingestion route, and the collector token is
explicitly rejected everywhere else. The token comparison is length-checked and then
`timingSafeEqual`, so a wrong token leaks nothing through timing.

## Layering inside the API

```
routes/        HTTP verbs, paths, and which middleware guards them
controllers/   parse and validate input, shape the response envelope
services/      the actual behaviour, no knowledge of HTTP
repositories/  SQL, and the only place that knows about column names
db/            pool, migrations, the Queryable interface
lib/           pure helpers: time, statistics, buckets, errors, jwt
scheduler/     things that run on an interval
```

The rule that keeps this honest: **a repository never throws an HTTP error and a
controller never writes SQL.** Repositories return `null` for "not found" and services
turn that into a `NotFoundError`, which the error middleware turns into a 404. Each
layer only knows the vocabulary of the layer below it.

Repositories take a `Queryable` — satisfied by both the pool and a transaction client —
so the same repository code works inside and outside a transaction.

## Caches, and where they are not allowed

Three read paths are cached in process:

| Cache             | TTL | Why                                                   |
| ----------------- | --- | ----------------------------------------------------- |
| Metric catalogue  | 60s | Ten rows that change approximately never              |
| Service directory | 30s | Read on every ingest batch and every evaluation       |
| Dashboard summary | 3s  | The hottest endpoint; several clients poll it at once |

Running the stack taught the limit of this. Creating an alert rule scoped to a service
that had just been registered returned 404, because the rule service was validating
against the cached directory. Caches serve read paths; **writes validate against the
database**. The rule service now resolves the slug through the repository.

The dashboard cache also deduplicates concurrent misses: several tabs refreshing at the
same moment share one in-flight query rather than starting one each.

## Where the truth about "is this service healthy" lives

Early on the dashboard computed status in the browser from the latest metric values.
That was two implementations of the same rules — one in the alert engine, one in
TypeScript running in the client — and they could disagree.

Now the alert engine is the only thing that decides. `GET /dashboard` reports each
service's status as the worst state of its firing alerts, with staleness as the one
exception the engine cannot see. The browser renders what it is told. Thresholds live
in exactly one place: the `alert_rules` table.

## Open questions left open

- Multiple collectors writing the same series would race on the deduplication key
  rather than coordinate. Fine for one collector, unsolved for a fleet.
- Alert state is per `(rule, service)`. There is no grouping, no inhibition, and no
  notification delivery — the engine records transitions and stops there.
- Rollups are computed on read. At a much larger volume they would need to be
  materialised, which is why the retention job is the natural place to write them.
