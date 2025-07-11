import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { query } from '../db/pool.js';
import { metricCatalog } from '../services/metricCatalog.js';
import { databaseAvailable, disconnect, prepareDatabase, resetDatabase } from './helpers/database.js';
import { COLLECTOR_TOKEN, bearer, createTestUser } from './helpers/auth.js';

const available = await databaseAvailable();
const app = createApp();
let auth = '';

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    service: 'checkout-api',
    recordedAt: new Date().toISOString(),
    metrics: { availability: 1, latency_ms: 42.5 },
    ...overrides,
  };
}

function post(snapshots: Record<string, unknown>[]): request.Test {
  return request(app)
    .post('/api/v1/ingest/snapshots')
    .set('authorization', bearer(COLLECTOR_TOKEN))
    .send({ collector: 'test', snapshots });
}

async function storedPointCount(): Promise<number> {
  const result = await query<{ count: number }>(
    'SELECT COUNT(*)::bigint AS count FROM metric_snapshots',
  );
  return result.rows[0]?.count ?? 0;
}

describe.skipIf(!available)('metric ingestion', () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    metricCatalog.invalidate();
    auth = bearer((await createTestUser('ADMIN')).token);
    await request(app)
      .post('/api/v1/services')
      .set('authorization', auth)
      .send({
        slug: 'checkout-api',
        displayName: 'Checkout API',
        baseUrl: 'http://checkout:8081',
      })
      .expect(201);
  });

  afterAll(async () => {
    await disconnect();
  });

  it('stores one row per metric in a snapshot', async () => {
    const response = await post([snapshot()]).expect(202);

    expect(response.body.data).toMatchObject({
      acceptedSnapshots: 1,
      acceptedPoints: 2,
      storedPoints: 2,
      rejected: [],
    });
    expect(await storedPointCount()).toBe(2);
  });

  it('is idempotent when a collector redelivers a batch', async () => {
    const payload = snapshot();
    await post([payload]).expect(202);
    const second = await post([payload]).expect(202);

    expect(second.body.data.storedPoints).toBe(0);
    expect(await storedPointCount()).toBe(2);
  });

  it('rejects snapshots for unregistered services without failing the batch', async () => {
    const response = await post([snapshot(), snapshot({ service: 'ghost-api' })]).expect(202);

    expect(response.body.data.acceptedSnapshots).toBe(1);
    expect(response.body.data.rejected).toEqual([
      { index: 1, service: 'ghost-api', reason: 'unknown service' },
    ]);
  });

  it('rejects timestamps outside the accepted window', async () => {
    const future = new Date(Date.now() + 30 * 60_000).toISOString();
    const ancient = new Date(Date.now() - 48 * 3_600_000).toISOString();

    const response = await post([
      snapshot({ recordedAt: future }),
      snapshot({ recordedAt: ancient }),
    ]).expect(202);

    expect(response.body.data.acceptedSnapshots).toBe(0);
    expect(response.body.data.rejected).toHaveLength(2);
    expect(await storedPointCount()).toBe(0);
  });

  it('drops out-of-range values but keeps the rest of the snapshot', async () => {
    const response = await post([
      snapshot({ metrics: { availability: 1, cpu_percent: 145, latency_ms: 20 } }),
    ]).expect(202);

    expect(response.body.data.acceptedPoints).toBe(2);
    expect(response.body.data.rejected[0].reason).toMatch(/cpu_percent must be between 0 and 100/);
    expect(await storedPointCount()).toBe(2);
  });

  it('reports unknown metric keys', async () => {
    const response = await post([
      snapshot({ metrics: { availability: 1, gpu_temperature: 60 } }),
    ]).expect(202);

    expect(response.body.data.rejected[0].reason).toMatch(/unknown metric 'gpu_temperature'/);
    expect(response.body.data.acceptedPoints).toBe(1);
  });

  it('accepts a large batch in a single request', async () => {
    const base = Date.now();
    const snapshots = Array.from({ length: 200 }, (_, index) =>
      snapshot({
        recordedAt: new Date(base - index * 1000).toISOString(),
        metrics: { availability: 1, latency_ms: 10 + index, cpu_percent: 20 },
      }),
    );

    const response = await post(snapshots).expect(202);

    expect(response.body.data.acceptedSnapshots).toBe(200);
    expect(response.body.data.storedPoints).toBe(600);
    expect(await storedPointCount()).toBe(600);
  });

  it('refuses batches larger than the ingestion limit', async () => {
    const snapshots = Array.from({ length: 501 }, () => snapshot());
    const response = await post(snapshots).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('refuses malformed payloads', async () => {
    await request(app)
      .post('/api/v1/ingest/snapshots')
      .set('authorization', bearer(COLLECTOR_TOKEN))
      .send({ collector: 'test', snapshots: [] })
      .expect(400);

    await post([snapshot({ metrics: {} })]).expect(400);
    await post([snapshot({ metrics: { 'Bad-Key': 1 } })]).expect(400);
  });
});
