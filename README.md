# prometheus-lite

A small monitoring platform, built to understand how systems like Prometheus and
Grafana actually work underneath the dashboards.

The goal is not to clone Prometheus. The goal is to build the pieces that make a
monitoring stack work — a collector that polls targets, a storage layer shaped for
time-series data, an engine that turns thresholds into alerts, and a dashboard that
makes all of it readable — and to understand the trade-offs in each.

## Planned components

| Component | Stack | Responsibility |
| --- | --- | --- |
| Collector | Python 3.13 | Poll targets on an interval, produce metric snapshots |
| API | TypeScript, Express | Ingest snapshots, serve queries, evaluate alerts |
| Storage | PostgreSQL | Time-series snapshots, rules, alert history |
| Dashboard | React, Vite, Tailwind | Visualise service health and trends |

## Status

Early. Schema and ingestion path first, dashboard once there is data worth drawing.
