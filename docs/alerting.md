# Alert engine

## What a rule is

A rule is a question asked of one metric on a fixed cadence:

> over the last `window_seconds`, is the `aggregation` of `metric` `comparison` the
> threshold, and has it been that way for `for_seconds`?

```sql
alert_rules (
  name, service_id, metric_id,
  comparison,          -- ABOVE | BELOW
  aggregation,         -- avg | max | min | last
  window_seconds,      -- how much history the question covers
  for_seconds,         -- how long the answer must stay 'yes' before firing
  warning_threshold, critical_threshold
)
```

`service_id IS NULL` means the rule applies to every enabled service. A rule with a
`service_id` applies to that one. The uniqueness index is on
`(name, COALESCE(service_id, 0))`, so "High p95 latency" can exist once globally and
once more with a per-service override.

Both thresholds are optional, but at least one is required — enforced by a `CHECK` in
the schema and again in the service layer, because the API should say _why_ a rule is
invalid rather than surfacing a constraint violation.

## Evaluation

Every 30 seconds (configurable) the engine:

1. Loads enabled rules and the service directory.
2. For each rule, runs one aggregate query across all the services in scope.
3. Compares each result to the thresholds.
4. Feeds the verdict through the state machine.
5. Writes the new state and any transition it produced.

Step 2 is the reason the engine is not slow. A naive implementation loops over
(rule × service) and runs a query each time; this runs one query per _rule_ and groups
by `service_id`, so twenty services and six rules is six queries rather than a hundred
and twenty.

### The window is half-open

The window is `[now - window_seconds, now)`. A sample landing exactly on `now` belongs
to the next evaluation, not this one. Without that rule a sample on the boundary would
be counted twice by consecutive evaluations, which quietly distorts every average. It
is the kind of off-by-one that produces alerts nobody can reproduce, so there is a test
named after it.

## Thresholds are inclusive

`ABOVE` breaches at `value >= threshold`; `BELOW` breaches at `value <= threshold`.

This bit once. The seeded downtime rule was `availability BELOW 1`, meaning "warn if
availability drops below perfect". With inclusive comparison, a perfectly healthy
service reporting `availability = 1.0` matched `1 <= 1` and every service on the
dashboard sat in permanent warning.

The comparison was not the bug — the threshold was. A rule that means "warn on any dip"
is `BELOW 0.99`. The fix shipped as a migration rather than an edit to the original
one, because the original had already been applied.

## The state machine

Three states, `OK`, `WARNING`, `CRITICAL`, and one rule about moving between them:

- **Escalating** (OK → WARNING, WARNING → CRITICAL) waits out `for_seconds`.
- **De-escalating** (anything → a calmer state) happens immediately.

Asymmetry is deliberate. Hold-down exists so a single unlucky scrape does not page
anyone; it has no business delaying the news that a problem is over. A recovery that
had to wait out the same window would leave the dashboard lying about the present.

While a breach is waiting out its hold-down the state row carries
`pending_state`/`pending_since`. If the breach clears the pending window is discarded;
if the severity changes the window restarts, because "warning for 90 seconds" is not
evidence for "critical".

The decision function is pure — `decide(current, observed, forSeconds, now)` — which is
why the interesting cases are unit tests with no database.

## Events and incidents

`alert_states` holds the present. `alert_events` holds the history: one row per
transition, with the value and threshold that caused it.

An incident is an event with `resolved_at IS NULL` and `to_state <> 'OK'`. A partial
unique index enforces at most one open incident per `(rule, service)`:

```sql
CREATE UNIQUE INDEX alert_events_open_incident_idx
    ON alert_events (rule_id, service_id)
    WHERE resolved_at IS NULL AND to_state <> 'OK';
```

Escalating from warning to critical therefore resolves the warning incident and opens a
critical one, rather than leaving two open. Recovery resolves the open incident and
writes an `X → OK` event that is born already resolved.

Storing both current state and history is redundant on paper — the state is the last
event. Keeping the state table means evaluation reads one row per series instead of
scanning history, and it is where `pending_since` lives, which is not a transition and
so has nowhere to go in an event log.

## Defaults

Provisioned on a fresh database and re-provisioned by the seeder:

| Rule                | Metric           | Window | For  | Warning | Critical |
| ------------------- | ---------------- | ------ | ---- | ------- | -------- |
| Service unreachable | `availability`   | 60s    | 30s  | < 0.99  | < 0.5    |
| High p95 latency    | `latency_p95_ms` | 300s   | 120s | > 500ms | > 1500ms |
| Elevated error rate | `error_rate`     | 300s   | 60s  | > 5%    | > 25%    |
| CPU saturation      | `cpu_percent`    | 300s   | 300s | > 80%   | > 92%    |
| Memory saturation   | `memory_percent` | 300s   | 300s | > 80%   | > 92%    |

Resource rules use a five-minute hold-down because a busy minute is not a problem;
five busy minutes might be. Downtime uses thirty seconds because it usually is.

## What is deliberately missing

No notifications, no grouping, no inhibition, no silences. The engine decides state and
records transitions. Everything a real alertmanager does with that decision — routing,
deduplicating, waking someone up — is a separate problem, and pretending to solve it
here would mean solving neither well.
