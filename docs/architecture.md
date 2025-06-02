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
     │  (scheduler)      │   builds metric snapshots
     └─────────┬─────────┘
               │  batched HTTP POST
               ▼
     ┌───────────────────┐
     │  Ingestion API    │   validate → normalise → batch insert
     └─────────┬─────────┘
               ▼
     ┌───────────────────┐
     │   PostgreSQL      │   time-series snapshots + metadata
     └─────────┬─────────┘
               │
        ┌──────┴───────┐
        ▼              ▼
  ┌───────────┐  ┌────────────┐
  │  Alert    │  │ Dashboard  │
  │  engine   │  │    API     │
  └─────┬─────┘  └──────┬─────┘
        │               │
        └──────┬────────┘
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
independently testable.

## Pull vs push

Prometheus pulls: the server scrapes targets it knows about. That makes target
discovery the server's problem and gives the server control over cadence.

Here the collector pulls from targets and pushes to the API. The collector owns the
polling schedule; the API only sees a stream of finished snapshots. This splits the
system at a place where the two halves can be written in different languages, which
is the point — the collector is Python because probing and sampling is what Python is
comfortable with, and the API is TypeScript because that is where the type-driven
query and alert logic will live.

The cost is that the API cannot tell the difference between "target is down" and
"collector is down". That gap is closed later with a collector heartbeat.

## Open questions

- Snapshot granularity: one row per metric, or one wide row per poll?
- How much aggregation happens at write time vs read time?
- Where does alert state live — recomputed each evaluation, or persisted?
