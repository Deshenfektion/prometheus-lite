# Time-series model

## The shape of the data

Everything the collector produces is the same shape: _this service, this metric, at this
instant, had this value_. That is the entire fact table.

```sql
CREATE TABLE metric_snapshots (
    service_id  BIGINT           NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    metric_id   SMALLINT         NOT NULL REFERENCES metrics (id) ON DELETE RESTRICT,
    recorded_at TIMESTAMPTZ      NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (service_id, metric_id, recorded_at)
);
```

## Narrow rows, not wide rows

The obvious alternative is a wide row per poll:

```sql
CREATE TABLE polls (service_id, recorded_at, latency_ms, cpu_percent, memory_percent, ...);
```

Wide rows are cheaper to write — one row instead of eight — and reading a whole snapshot
is a single row fetch. They lose on everything else:

- Adding a metric means a migration and a nullable column, forever.
- Services that only report some metrics store NULLs for the rest.
- A query for one metric over a week still reads every other metric's bytes.

Narrow rows make the metric catalogue data instead of schema. A new metric is an
`INSERT INTO metrics`, not an `ALTER TABLE`. This is the same trade Prometheus makes:
the series is the unit, and a "snapshot" only exists at query time.

The cost is row count. Nine metrics at a 10-second interval for one service is 77,760
rows per day. Twenty services is 1.5M rows per day. That number is why the retention
policy and the index layout below matter.

## Why the primary key is ordered that way

`PRIMARY KEY (service_id, metric_id, recorded_at)` is not an arbitrary ordering. Every
dashboard query has the same shape:

```sql
SELECT recorded_at, value
  FROM metric_snapshots
 WHERE service_id = $1 AND metric_id = $2
   AND recorded_at >= $3 AND recorded_at < $4
```

With that key the query is a single index range scan: the equality predicates pin a
prefix, the time range becomes a contiguous slice inside it. Leading with `recorded_at`
instead would force a scan over every service in the window and a filter afterwards.

A secondary index on `recorded_at DESC` exists for the queries that genuinely are
time-first: retention deletes and "what happened across the whole fleet at 14:03".

## The primary key is also the deduplication key

The collector retries failed batches. Retries can duplicate snapshots that actually did
land — the API's response was lost, not the write. Because `(service_id, metric_id,
recorded_at)` is unique and inserts use `ON CONFLICT DO NOTHING`, a redelivered batch is
a no-op rather than a duplicated data point.

This is why timestamps are normalised to millisecond precision at the edge. If the
collector sent microseconds and the API truncated them, a retry could produce a
_different_ key for the same reading and the deduplication would silently stop working.

## Writing efficiently

The first implementation looped over points and issued one `INSERT` per row inside a
transaction. Correct, and slow: every row is a round trip.

The current implementation passes four arrays and lets Postgres expand them:

```sql
INSERT INTO metric_snapshots (service_id, metric_id, recorded_at, value)
SELECT * FROM UNNEST($1::bigint[], $2::smallint[], $3::timestamptz[], $4::double precision[])
ON CONFLICT (service_id, metric_id, recorded_at) DO NOTHING
```

The useful property is that the parameter count is fixed at four no matter how many rows
are in the batch. A multi-row `VALUES` list would use four parameters _per row_ and hit
the 65,535 parameter ceiling at around 16,000 rows.

Measured with `npm run benchmark --workspace services/api`, 50,000 points into Postgres 17
in a local container:

| Strategy                                 | Rows/s  |
| ---------------------------------------- | ------- |
| One `INSERT` per row, single transaction | ~1,700  |
| `UNNEST` batches of 5,000                | ~33,000 |

These are laptop numbers against a container on the same machine, so treat the ratio as
the finding and the absolute values as an upper bound for this hardware. The ratio is
where the design decision lives: batching is worth roughly an order of magnitude, and it
is the difference between "one collector" and "many collectors" being affordable.

## Aggregation at read time

Snapshots are stored raw. Aggregation happens in the query:

```sql
SELECT to_timestamp(floor(extract(epoch FROM recorded_at) / $bucket) * $bucket) AS bucket,
       avg(value), max(value), min(value)
  FROM metric_snapshots
 WHERE ...
 GROUP BY bucket
```

Pre-aggregating into rollup tables at write time would make dashboard queries cheaper,
but it fixes the bucket sizes in advance and makes late-arriving data awkward. At this
data volume, computing buckets on read is fast enough, and it keeps exactly one copy of
the truth.

If the dataset outgrew that, the next step is a materialised rollup table written by the
retention job — which already walks the same rows.

## Retention

Raw snapshots are not worth keeping forever. The retention job deletes rows older than a
configured age, in bounded chunks so a long-overdue cleanup cannot lock the table for
minutes at a time.
