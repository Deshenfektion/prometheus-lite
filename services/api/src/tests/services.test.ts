import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { databaseAvailable, disconnect, prepareDatabase, resetDatabase } from './helpers/database.js';

const available = await databaseAvailable();
const app = createApp();

describe.skipIf(!available)('service registry', () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  it('starts with an empty registry', async () => {
    const response = await request(app).get('/api/v1/services').expect(200);
    expect(response.body).toEqual({ data: [] });
  });

  it('registers a service and applies defaults', async () => {
    const response = await request(app)
      .post('/api/v1/services')
      .send({
        slug: 'checkout-api',
        displayName: 'Checkout API',
        baseUrl: 'http://checkout:8081',
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      slug: 'checkout-api',
      healthPath: '/health',
      environment: 'production',
      pollIntervalSeconds: 15,
      timeoutMs: 3000,
      enabled: true,
    });
  });

  it('rejects a malformed slug', async () => {
    const response = await request(app)
      .post('/api/v1/services')
      .send({ slug: 'Checkout API', displayName: 'Checkout API', baseUrl: 'http://checkout:8081' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a duplicate slug with 409', async () => {
    const payload = {
      slug: 'checkout-api',
      displayName: 'Checkout API',
      baseUrl: 'http://checkout:8081',
    };
    await request(app).post('/api/v1/services').send(payload).expect(201);
    const response = await request(app).post('/api/v1/services').send(payload).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('filters by environment and enabled state', async () => {
    await request(app)
      .post('/api/v1/services')
      .send({
        slug: 'checkout-api',
        displayName: 'Checkout API',
        baseUrl: 'http://checkout:8081',
        environment: 'production',
      })
      .expect(201);
    await request(app)
      .post('/api/v1/services')
      .send({
        slug: 'search-api',
        displayName: 'Search API',
        baseUrl: 'http://search:8082',
        environment: 'staging',
        enabled: false,
      })
      .expect(201);

    const staging = await request(app).get('/api/v1/services?environment=staging').expect(200);
    expect(staging.body.data).toHaveLength(1);
    expect(staging.body.data[0].slug).toBe('search-api');

    const disabled = await request(app).get('/api/v1/services?enabled=false').expect(200);
    expect(disabled.body.data).toHaveLength(1);
    expect(disabled.body.data[0].slug).toBe('search-api');
  });

  it('updates and deletes a service', async () => {
    await request(app)
      .post('/api/v1/services')
      .send({ slug: 'search-api', displayName: 'Search API', baseUrl: 'http://search:8082' })
      .expect(201);

    const patched = await request(app)
      .patch('/api/v1/services/search-api')
      .send({ pollIntervalSeconds: 30, enabled: false })
      .expect(200);
    expect(patched.body.data.pollIntervalSeconds).toBe(30);
    expect(patched.body.data.enabled).toBe(false);

    await request(app).delete('/api/v1/services/search-api').expect(204);
    await request(app).get('/api/v1/services/search-api').expect(404);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await request(app).get('/api/v1/nope').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
