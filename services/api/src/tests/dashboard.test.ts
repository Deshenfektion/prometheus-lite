import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { AlertEngine } from '../services/alertEngine.js';
import { dashboardService } from '../services/dashboardService.js';
import { RetentionService } from '../services/retentionService.js';
import { query } from '../db/pool.js';
import { bearer, createTestUser } from './helpers/auth.js';
import { databaseAvailable, prepareDatabase, resetDatabase } from './helpers/database.js';
import { createRule, createService, samplesEvery, writeSamples } from './helpers/fixtures.js';

const available = await databaseAvailable();
const app = createApp();
const engine = new AlertEngine();
const retention = new RetentionService();

async function snapshotCount(): Promise<number> {
  const result = await query<{ count: number }>(
    'SELECT COUNT(*)::bigint AS count FROM metric_snapshots',
  );
  return result.rows[0]?.count ?? 0;
}

describe.skipIf(!available)('dashboard summary', () => {
  let auth = '';

  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    dashboardService.invalidate();
    auth = bearer((await createTestUser('USER')).token);
  });

  it('reports an empty fleet', async () => {
    const response = await request(app)
      .get('/api/v1/dashboard')
      .set('authorization', auth)
      .expect(200);

    expect(response.body.data.totals).toMatchObject({ services: 0, ok: 0, activeAlerts: 0 });
    expect(response.body.data.services).toEqual([]);
  });

  it('marks a service with no data as unknown', async () => {
    await createService('checkout-api');
    dashboardService.invalidate();

    const response = await request(app)
      .get('/api/v1/dashboard')
      .set('authorization', auth)
      .expect(200);

    expect(response.body.data.services[0]).toMatchObject({
      slug: 'checkout-api',
      status: 'UNKNOWN',
      lastSeen: null,
    });
    expect(response.body.data.totals.unknown).toBe(1);
  });

  it('reports a freshly reporting service as healthy with its latest values', async () => {
    const serviceId = await createService('checkout-api');
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, new Date(), 42));
    await writeSamples(serviceId, 'cpu_percent', samplesEvery(10, 3, new Date(), 21));
    dashboardService.invalidate();

    const response = await request(app)
      .get('/api/v1/dashboard')
      .set('authorization', auth)
      .expect(200);

    const service = response.body.data.services[0];
    expect(service.status).toBe('OK');
    expect(service.metrics.latency_p95_ms.value).toBe(42);
    expect(service.metrics.cpu_percent.value).toBe(21);
    expect(response.body.data.totals.ok).toBe(1);
  });

  it('marks a service whose data has gone stale as unknown', async () => {
    const serviceId = await createService('checkout-api');
    const old = new Date(Date.now() - 30 * 60_000);
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, old, 42));
    dashboardService.invalidate();

    const response = await request(app)
      .get('/api/v1/dashboard')
      .set('authorization', auth)
      .expect(200);

    expect(response.body.data.services[0].status).toBe('UNKNOWN');
    expect(response.body.data.services[0].reasons).toContain('no recent snapshots');
  });

  it('takes the service status from the firing alerts', async () => {
    const serviceId = await createService('checkout-api');
    await createRule({ name: 'p95', metricKey: 'latency_p95_ms', warning: 100, critical: 1000 });
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 4, new Date(), 4000));
    await engine.evaluate();
    dashboardService.invalidate();

    const response = await request(app)
      .get('/api/v1/dashboard')
      .set('authorization', auth)
      .expect(200);

    expect(response.body.data.services[0].status).toBe('CRITICAL');
    expect(response.body.data.services[0].reasons[0]).toMatch(/above the critical threshold/);
    expect(response.body.data.totals).toMatchObject({ critical: 1, activeAlerts: 1 });
  });

  it('serves a cached summary within the ttl', async () => {
    await createService('checkout-api');
    dashboardService.invalidate();

    const first = await request(app).get('/api/v1/dashboard').set('authorization', auth);
    await createService('search-api');
    const second = await request(app).get('/api/v1/dashboard').set('authorization', auth);

    expect(second.body.data.generatedAt).toBe(first.body.data.generatedAt);

    dashboardService.invalidate();
    const third = await request(app).get('/api/v1/dashboard').set('authorization', auth);
    expect(third.body.data.services).toHaveLength(2);
  });

  it('needs authentication', async () => {
    await request(app).get('/api/v1/dashboard').expect(401);
  });
});

describe.skipIf(!available)('retention', () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  const options = {
    snapshotRetentionDays: 7,
    eventRetentionDays: 30,
    chunkSize: 1_000,
    maxChunks: 10,
  };

  it('keeps snapshots inside the retention window', async () => {
    const serviceId = await createService('checkout-api');
    await writeSamples(serviceId, 'latency_ms', samplesEvery(60, 10, new Date(), 42));

    const report = await retention.prune(options);

    expect(report.snapshotsDeleted).toBe(0);
    expect(await snapshotCount()).toBe(10);
  });

  it('deletes snapshots older than the retention window', async () => {
    const serviceId = await createService('checkout-api');
    const old = new Date(Date.now() - 10 * 86_400_000);
    await writeSamples(serviceId, 'latency_ms', samplesEvery(60, 8, old, 42));
    await writeSamples(serviceId, 'latency_ms', samplesEvery(60, 4, new Date(), 42));

    const report = await retention.prune(options);

    expect(report.snapshotsDeleted).toBe(8);
    expect(await snapshotCount()).toBe(4);
  });

  it('stops once it runs out of chunks and says so', async () => {
    const serviceId = await createService('checkout-api');
    const old = new Date(Date.now() - 10 * 86_400_000);
    await writeSamples(serviceId, 'latency_ms', samplesEvery(1, 20, old, 42));

    const report = await retention.prune({ ...options, chunkSize: 5, maxChunks: 2 });

    expect(report.snapshotsDeleted).toBe(10);
    expect(report.chunksRun).toBe(2);
    expect(report.reachedLimit).toBe(true);
    expect(await snapshotCount()).toBe(10);
  });

  it('leaves unresolved alert events alone', async () => {
    const serviceId = await createService('checkout-api');
    await createRule({ name: 'p95', metricKey: 'latency_p95_ms', warning: 100 });
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 4, new Date(), 4000));
    await engine.evaluate();

    await query("UPDATE alert_events SET occurred_at = now() - interval '90 days'");
    const report = await retention.prune(options);

    expect(report.eventsDeleted).toBe(0);
  });

  it('deletes old resolved alert events', async () => {
    const serviceId = await createService('checkout-api');
    await createRule({ name: 'p95', metricKey: 'latency_p95_ms', warning: 100 });
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 4, new Date(), 4000));
    await engine.evaluate();

    await query(
      "UPDATE alert_events SET occurred_at = now() - interval '90 days', resolved_at = now()",
    );
    const report = await retention.prune(options);

    expect(report.eventsDeleted).toBe(1);
  });
});
