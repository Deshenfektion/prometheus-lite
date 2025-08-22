CREATE INDEX metric_snapshots_metric_time_idx
    ON metric_snapshots (metric_id, recorded_at DESC)
    INCLUDE (service_id, value);

CREATE INDEX alert_states_open_idx
    ON alert_states (state, since DESC)
    WHERE state <> 'OK';

CREATE INDEX services_enabled_idx
    ON services (enabled, slug)
    WHERE enabled;

ANALYZE metric_snapshots;
