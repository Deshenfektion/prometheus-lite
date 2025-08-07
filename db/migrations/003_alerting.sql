CREATE TABLE alert_rules (
    id                 BIGSERIAL PRIMARY KEY,
    name               TEXT             NOT NULL,
    description        TEXT             NOT NULL DEFAULT '',
    service_id         BIGINT           REFERENCES services (id) ON DELETE CASCADE,
    metric_id          SMALLINT         NOT NULL REFERENCES metrics (id) ON DELETE RESTRICT,
    comparison         TEXT             NOT NULL DEFAULT 'ABOVE',
    aggregation        TEXT             NOT NULL DEFAULT 'avg',
    window_seconds     INTEGER          NOT NULL DEFAULT 60,
    for_seconds        INTEGER          NOT NULL DEFAULT 0,
    warning_threshold  DOUBLE PRECISION,
    critical_threshold DOUBLE PRECISION,
    enabled            BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT alert_rules_comparison_allowed CHECK (comparison IN ('ABOVE', 'BELOW')),
    CONSTRAINT alert_rules_aggregation_allowed CHECK (aggregation IN ('avg', 'max', 'min', 'last')),
    CONSTRAINT alert_rules_window_range CHECK (window_seconds BETWEEN 10 AND 86400),
    CONSTRAINT alert_rules_for_range CHECK (for_seconds BETWEEN 0 AND 86400),
    CONSTRAINT alert_rules_needs_a_threshold CHECK (
        warning_threshold IS NOT NULL OR critical_threshold IS NOT NULL
    )
);

CREATE UNIQUE INDEX alert_rules_name_scope_idx
    ON alert_rules (name, COALESCE(service_id, 0));

CREATE TRIGGER alert_rules_set_updated_at
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE alert_states (
    rule_id           BIGINT           NOT NULL REFERENCES alert_rules (id) ON DELETE CASCADE,
    service_id        BIGINT           NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    state             TEXT             NOT NULL DEFAULT 'OK',
    since             TIMESTAMPTZ      NOT NULL DEFAULT now(),
    pending_state     TEXT,
    pending_since     TIMESTAMPTZ,
    last_value        DOUBLE PRECISION,
    last_evaluated_at TIMESTAMPTZ      NOT NULL DEFAULT now(),
    PRIMARY KEY (rule_id, service_id),
    CONSTRAINT alert_states_state_allowed CHECK (state IN ('OK', 'WARNING', 'CRITICAL')),
    CONSTRAINT alert_states_pending_allowed CHECK (
        pending_state IS NULL OR pending_state IN ('OK', 'WARNING', 'CRITICAL')
    )
);

CREATE TABLE alert_events (
    id           BIGSERIAL PRIMARY KEY,
    rule_id      BIGINT           NOT NULL REFERENCES alert_rules (id) ON DELETE CASCADE,
    service_id   BIGINT           NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    from_state   TEXT             NOT NULL,
    to_state     TEXT             NOT NULL,
    value        DOUBLE PRECISION NOT NULL,
    threshold    DOUBLE PRECISION,
    message      TEXT             NOT NULL,
    occurred_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    CONSTRAINT alert_events_states_allowed CHECK (
        from_state IN ('OK', 'WARNING', 'CRITICAL') AND to_state IN ('OK', 'WARNING', 'CRITICAL')
    ),
    CONSTRAINT alert_events_is_a_transition CHECK (from_state <> to_state)
);

CREATE INDEX alert_events_occurred_at_idx ON alert_events (occurred_at DESC);
CREATE INDEX alert_events_service_idx ON alert_events (service_id, occurred_at DESC);
CREATE UNIQUE INDEX alert_events_open_incident_idx
    ON alert_events (rule_id, service_id)
    WHERE resolved_at IS NULL AND to_state <> 'OK';

INSERT INTO alert_rules
    (name, description, metric_id, comparison, aggregation, window_seconds, for_seconds,
     warning_threshold, critical_threshold)
VALUES
    ('Service unreachable',
     'The last probes could not reach the service',
     (SELECT id FROM metrics WHERE key = 'availability'),
     'BELOW', 'avg', 60, 30, 1, 0.5),

    ('High p95 latency',
     'The 95th percentile probe latency is elevated',
     (SELECT id FROM metrics WHERE key = 'latency_p95_ms'),
     'ABOVE', 'avg', 300, 120, 500, 1500),

    ('Elevated error rate',
     'A meaningful share of probes is failing',
     (SELECT id FROM metrics WHERE key = 'error_rate'),
     'ABOVE', 'avg', 300, 60, 0.05, 0.25),

    ('CPU saturation',
     'Reported CPU utilisation is close to the limit',
     (SELECT id FROM metrics WHERE key = 'cpu_percent'),
     'ABOVE', 'avg', 300, 300, 80, 92),

    ('Memory saturation',
     'Reported memory utilisation is close to the limit',
     (SELECT id FROM metrics WHERE key = 'memory_percent'),
     'ABOVE', 'avg', 300, 300, 80, 92);
