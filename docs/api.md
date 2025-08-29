# HTTP API

Base path `/api/v1`. Every response is wrapped:

```json
{ "data": ... }
```

Errors use the same envelope shape with a machine-readable code:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request body",
    "details": { "issues": [] }
  }
}
```

| Code                | Status |
| ------------------- | ------ |
| `VALIDATION_FAILED` | 400    |
| `UNAUTHORIZED`      | 401    |
| `FORBIDDEN`         | 403    |
| `NOT_FOUND`         | 404    |
| `CONFLICT`          | 409    |
| `INTERNAL_ERROR`    | 500    |

## Authentication

`POST /auth/login` returns a JWT valid for one hour. Send it as
`Authorization: Bearer <token>` on every route except `/health` and `/auth/login`.

```http
POST /api/v1/auth/login
{ "email": "admin@example.com", "password": "..." }

200
{ "data": { "token": "...", "expiresIn": 3600, "expiresAt": "...", "user": { "role": "ADMIN" } } }
```

`POST /auth/logout` returns 204. The token is not revoked server-side — logout is the
client discarding it. Tokens are short-lived instead of revocable, which is the honest
trade for a system with no session store. A denylist would be the next step if tokens
needed to outlive an hour.

`GET /auth/me` returns the signed-in user.

Ingestion uses a separate static token (`INGEST_TOKEN`) and is the only route that
accepts it. A user JWT is rejected there, and the collector token is rejected
everywhere else.

## Services

| Method   | Path              | Role    |
| -------- | ----------------- | ------- |
| `GET`    | `/services`       | any     |
| `GET`    | `/services/:slug` | any     |
| `POST`   | `/services`       | `ADMIN` |
| `PATCH`  | `/services/:slug` | `ADMIN` |
| `DELETE` | `/services/:slug` | `ADMIN` |

`GET /services` accepts `?environment=` and `?enabled=true|false`.

```http
POST /api/v1/services
{
  "slug": "checkout-api",
  "displayName": "Checkout API",
  "baseUrl": "http://checkout:8081",
  "healthPath": "/health",
  "environment": "production",
  "pollIntervalSeconds": 10,
  "timeoutMs": 2000
}
```

Deleting a service cascades to its snapshots and alert state.

## Ingestion

```http
POST /api/v1/ingest/snapshots
Authorization: Bearer <INGEST_TOKEN>

{
  "collector": "collector-1",
  "snapshots": [
    {
      "service": "checkout-api",
      "recordedAt": "2025-05-24T09:15:30.120Z",
      "metrics": { "availability": 1, "latency_ms": 42.5, "cpu_percent": 31.2 }
    }
  ]
}

202
{
  "data": {
    "acceptedSnapshots": 1,
    "acceptedPoints": 3,
    "storedPoints": 3,
    "rejected": []
  }
}
```

**Partial acceptance is the point.** A batch with one bad snapshot stores the rest and
reports what it dropped, so one misconfigured target cannot block a collector's whole
payload. `202` means "batch processed" — read `rejected` to find out what did not make
it.

A snapshot is rejected when its service is not registered, its timestamp is more than
five minutes in the future or more than 24 hours old, or every one of its metrics is
unknown or out of range. Individual metrics can be dropped while the snapshot is
accepted; the reason names the metric.

`storedPoints` may be lower than `acceptedPoints` on a retried batch: the primary key
deduplicates, so redelivery stores nothing and reports zero.

Limits: 500 snapshots per batch, 1 MB per request.

## Metrics

`GET /metrics` — the metric catalogue.

`GET /metrics/latest` — the newest value of every metric for every service.

`GET /metrics/history` — a time series per metric.

| Parameter    | Default                                  |
| ------------ | ---------------------------------------- |
| `service`    | required                                 |
| `metrics`    | comma-separated; all metrics if omitted  |
| `from`, `to` | ISO-8601; last hour if omitted           |
| `step`       | seconds; chosen automatically if omitted |
| `limit`      | 5000 max                                 |

```json
{
  "data": [
    {
      "service": "checkout-api",
      "metric": "latency_p95_ms",
      "unit": "milliseconds",
      "stepSeconds": 60,
      "points": [{ "recordedAt": "...", "value": 91.2, "min": 88, "max": 140, "samples": 6 }]
    }
  ]
}
```

`stepSeconds` is `null` when the response is raw samples, in which case `min`, `max`
and `samples` are absent. Maximum window is seven days.

`GET /metrics/anomalies` takes the same parameters plus `window` (baseline size,
default 30), `threshold` (default 3.5) and `method` (`modified-zscore` or `zscore`),
and returns the same series with an `anomalies` array attached.

## Alerts

| Method   | Path                | Role                            |
| -------- | ------------------- | ------------------------------- |
| `GET`    | `/alerts`           | any — currently firing          |
| `GET`    | `/alerts/events`    | any — transition history        |
| `GET`    | `/alerts/rules`     | any                             |
| `POST`   | `/alerts/rules`     | `ADMIN`                         |
| `PATCH`  | `/alerts/rules/:id` | `ADMIN`                         |
| `DELETE` | `/alerts/rules/:id` | `ADMIN`                         |
| `POST`   | `/alerts/evaluate`  | `ADMIN` — run an evaluation now |

`GET /alerts/events` accepts `?service=`, `?state=`, `?since=` and `?limit=`.

```http
POST /api/v1/alerts/rules
{
  "name": "Checkout latency",
  "metricKey": "latency_p95_ms",
  "serviceSlug": "checkout-api",
  "comparison": "ABOVE",
  "aggregation": "avg",
  "windowSeconds": 300,
  "forSeconds": 120,
  "warningThreshold": 250,
  "criticalThreshold": 800
}
```

`serviceSlug` may be `null` for a rule that applies to every service. At least one
threshold is required.

## Dashboard

`GET /dashboard` returns everything the overview needs in one response: totals, one row
per service with its status and latest values, and the firing alerts. Cached for three
seconds.

```json
{
  "data": {
    "generatedAt": "2025-05-24T09:15:33.000Z",
    "totals": {
      "services": 3,
      "ok": 2,
      "warning": 1,
      "critical": 0,
      "unknown": 0,
      "activeAlerts": 1,
      "criticalAlerts": 0
    },
    "services": [
      {
        "slug": "checkout-api",
        "status": "OK",
        "reasons": [],
        "lastSeen": "2025-05-24T09:15:30.120Z",
        "metrics": { "latency_p95_ms": { "value": 91.2, "recordedAt": "..." } }
      }
    ],
    "alerts": []
  }
}
```

`status` comes from the alert engine, not from thresholds applied in the browser. The
one exception is `UNKNOWN`, which means no snapshot has arrived in six poll intervals —
a condition the engine cannot observe, because it is the absence of data rather than a
value.

## Health

`GET /health` is unauthenticated and checks database reachability. It returns 503 with
`{"status":"degraded"}` when the database is unavailable, so a container orchestrator
can act on it.
