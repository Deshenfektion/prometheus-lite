# Performance

Every number here was measured on the machine this was built on: an Apple Silicon
laptop running Postgres 17 in a local VM, with the API on the same host. They are not
server benchmarks. What is worth taking from them is the _shape_ — which changes moved
the needle and by how much — not the absolute values.

The dataset for the query measurements is 76,800 snapshot rows across four services and
ten metrics.

## Writes

`npm run benchmark --workspace services/api` inserts 50,000 points with each strategy:

| Strategy                              | Throughput     |
| ------------------------------------- | -------------- |
| One `INSERT` per row, one transaction | ~1,700 rows/s  |
| `UNNEST` arrays, 5,000-row chunks     | ~33,000 rows/s |

Roughly twenty times faster, and the reason is round trips rather than Postgres. Fifty
thousand statements is fifty thousand round trips; ten array-parameter statements is
ten.

`UNNEST` also has a property a multi-row `VALUES` list does not: the parameter count is
fixed at four regardless of batch size. `VALUES` uses four parameters per row and hits
the 65,535 parameter ceiling somewhere around 16,000 rows, so it needs chunking to stay
correct. `UNNEST` only needs chunking to bound memory.

## Ingestion end to end

Forty sequential batches of 200 snapshots each (1,200 metric points per request,
48,000 points total) through the real HTTP path — validation, timestamp normalisation,
fan-out, insert:

| Measure     | Value                                     |
| ----------- | ----------------------------------------- |
| p50 request | 39.4 ms                                   |
| p95 request | 45.0 ms                                   |
| p99 request | 94.7 ms                                   |
| Throughput  | ~28,800 points/s (one client, sequential) |

That is one client waiting for each response. It is enough headroom that the collector
cadence is not the constraint: three services at a 10-second interval produce about
three points per second.

The batch size limit is 500 snapshots. It exists so a single request cannot pin a
connection for an unbounded time, and so a malformed or hostile payload has a bounded
cost.

## Reads

| Query                                          | Time    |
| ---------------------------------------------- | ------- |
| `GET /dashboard` (cache miss)                  | 13 ms   |
| `GET /dashboard` (cache hit)                   | ~0.9 ms |
| `GET /metrics/history`, 1h, 2 metrics, raw     | 26 ms   |
| `GET /metrics/history`, 7d, 1 metric, bucketed | 1.3 ms  |
| Alert evaluation, 5 rules × 4 services         | 46 ms   |

The seven-day query being faster than the one-hour query is not a mistake. The
one-hour window is under the point budget so it returns raw samples — several thousand
rows to serialise. The seven-day window is far over it, so it is aggregated into
buckets in Postgres and returns a few hundred. **Aggregating in the database is cheaper
than shipping rows to Node and reducing them there**, and the wider the window the
truer that gets.

### The step ladder

Rather than letting the client pick a bucket size, the API derives one from the window
and a point budget, snapped to a fixed ladder (1s, 5s, 10s, 15s, 30s, 60s … 86400s).
Fixed steps mean the bucket boundaries for a given step are stable no matter when the
query runs, so consecutive refreshes do not shuffle every point sideways by a few
seconds.

Below the budget the API returns raw samples and reports `stepSeconds: null`, so the
dashboard can be honest about whether it is drawing measurements or averages.

### The index that mattered, and the one that backfired

The dashboard's hottest query is "the newest value of every metric for every service".
The obvious `DISTINCT ON` planned as a sequential scan and a full sort:

```
Unique  (actual time=11.982..15.407 rows=40)
  ->  Sort  (actual rows=28800)  Sort Method: quicksort  Memory: 2119kB
        ->  Seq Scan on metric_snapshots  (actual rows=28800)
```

Sorting 28,800 rows to return 40. Rewritten as a lateral join, each series does an
index seek and stops at the first row:

```
Nested Loop  (actual time=0.050..0.197 rows=40)
  ->  Limit  (actual rows=1 loops=40)
        ->  Index Only Scan  (Heap Fetches: 0)
```

15.4 ms to 0.197 ms — but the ratio is the less interesting part. The `DISTINCT ON`
cost scales with **rows stored**; the lateral join scales with **series count**. One of
those grows every second the collector runs.

The covering index added in the same migration was not a free win. It made the
fleet-wide alert aggregate an index-only scan, which was the goal, but the planner then
also chose it for single-service history queries where the primary key
`(service_id, metric_id, recorded_at)` is an exact prefix match:

```
Index Only Scan using metric_snapshots_metric_time_idx
  Filter: (service_id = 1)
  Rows Removed by Filter: 1074      -- to keep 358
```

Three quarters of the rows read are discarded. At four services it is cheaper than the
heap fetches the primary key would need, so the planner is not wrong today. At forty
services it would be, and the planner should switch on its own once the statistics say
so. It is recorded here because "adding an index made another query worse" is the
normal outcome, not an unusual one.

## The dashboard cache

`GET /dashboard` is the endpoint every open tab polls. It joins services, latest
values, and alert state, so it is also the most expensive read.

A three-second TTL cache in front of it takes a cache hit from 13 ms to under a
millisecond. Three seconds is short enough that nobody notices staleness against a
ten-second refresh interval, and long enough that ten tabs refreshing together cost one
query.

The cache also collapses concurrent misses: the first caller starts the query, everyone
who arrives while it is in flight waits on the same promise. Without that, a cold cache
and ten tabs is ten identical queries.

## Choosing the collector cadence

Storage cost is linear and easy to underestimate. One service, nine metrics, one poll
every ten seconds:

```
9 metrics × 6 polls/min × 60 min × 24 h  =  77,760 rows/day/service
```

Twenty services is about 1.5M rows/day. At roughly 40 bytes per row plus index overhead
this is on the order of 100 MB/day before compression — fine for a fortnight of
retention, not fine forever. That arithmetic is why retention is a scheduled job rather
than a future idea.

The knobs, in the order worth turning:

1. **Poll interval.** Linear in everything. Ten seconds is a reasonable floor for HTTP
   health probing; anything faster is measuring your own network.
2. **Retention.** `RETENTION_SNAPSHOT_DAYS`, default 14.
3. **Batch size and max wait.** The collector ships when it has 200 snapshots or after
   2 seconds, whichever comes first. Raising the wait makes batches bigger and the
   dashboard staler.
4. **Evaluation interval.** 30 seconds by default. Cost is one query per rule.

## Bounded work everywhere

Any job that can fall behind is bounded, so that being behind never becomes being down:

- Retention deletes in chunks of 10,000 with a per-pass ceiling of 50 chunks, so a
  neglected database is cleaned over several passes instead of one long lock.
- The scheduler skips a tick if the previous run has not finished, and logs that it
  did, rather than stacking overlapping evaluations.
- The collector's queue is capped at 10,000 snapshots; past that it sheds load and
  counts what it dropped.
- The disk buffer keeps at most 200 spooled batches and evicts the oldest first, so a
  long API outage cannot fill the disk.

Every one of those limits is configurable, and every one of them logs when it is hit.
A silent limit is indistinguishable from a bug.
