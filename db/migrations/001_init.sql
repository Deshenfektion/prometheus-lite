CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE services (
    id                   BIGSERIAL PRIMARY KEY,
    slug                 TEXT        NOT NULL UNIQUE,
    display_name         TEXT        NOT NULL,
    base_url             TEXT        NOT NULL,
    health_path          TEXT        NOT NULL DEFAULT '/health',
    environment          TEXT        NOT NULL DEFAULT 'production',
    poll_interval_seconds INTEGER    NOT NULL DEFAULT 15,
    timeout_ms           INTEGER     NOT NULL DEFAULT 3000,
    enabled              BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT services_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    CONSTRAINT services_poll_interval_range CHECK (poll_interval_seconds BETWEEN 1 AND 3600),
    CONSTRAINT services_timeout_range CHECK (timeout_ms BETWEEN 100 AND 60000)
);

CREATE TRIGGER services_set_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE metrics (
    id           SMALLSERIAL PRIMARY KEY,
    key          TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    unit         TEXT NOT NULL,
    kind         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    CONSTRAINT metrics_kind_allowed CHECK (kind IN ('gauge', 'counter', 'ratio')),
    CONSTRAINT metrics_key_format CHECK (key ~ '^[a-z][a-z0-9_]{1,62}$')
);

CREATE TABLE metric_snapshots (
    service_id  BIGINT           NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    metric_id   SMALLINT         NOT NULL REFERENCES metrics (id) ON DELETE RESTRICT,
    recorded_at TIMESTAMPTZ      NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (service_id, metric_id, recorded_at)
);

CREATE INDEX metric_snapshots_recorded_at_idx
    ON metric_snapshots (recorded_at DESC);

INSERT INTO metrics (key, display_name, unit, kind, description) VALUES
    ('availability',    'Availability',      'boolean',      'gauge', '1 when the last probe succeeded, 0 otherwise'),
    ('http_status',     'HTTP status code',  'code',         'gauge', 'Status code returned by the health probe'),
    ('latency_ms',      'Latency',           'milliseconds', 'gauge', 'Round trip time of the health probe'),
    ('latency_avg_ms',  'Average latency',   'milliseconds', 'gauge', 'Mean probe latency over the collection window'),
    ('latency_p95_ms',  'p95 latency',       'milliseconds', 'gauge', '95th percentile probe latency over the collection window'),
    ('latency_p99_ms',  'p99 latency',       'milliseconds', 'gauge', '99th percentile probe latency over the collection window'),
    ('cpu_percent',     'CPU usage',         'percent',      'gauge', 'Reported process CPU utilisation'),
    ('memory_percent',  'Memory usage',      'percent',      'gauge', 'Reported process memory utilisation'),
    ('throughput_rps',  'Throughput',        'requests/s',   'gauge', 'Requests per second reported by the target'),
    ('error_rate',      'Error rate',        'ratio',        'ratio', 'Fraction of probes in the window that failed');
