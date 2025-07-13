import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { signAccessToken } from '../lib/jwt.js';
import { COLLECTOR_TOKEN, TEST_PASSWORD, bearer, createTestUser } from './helpers/auth.js';
import { databaseAvailable, prepareDatabase, resetDatabase } from './helpers/database.js';

const available = await databaseAvailable();
const app = createApp();

describe.skipIf(!available)('authentication', () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('issues a token for valid credentials', async () => {
    const user = await createTestUser('USER');

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    expect(response.body.data.token).toBeTypeOf('string');
    expect(response.body.data.expiresIn).toBeGreaterThan(0);
    expect(response.body.data.user).toMatchObject({ email: user.email, role: 'USER' });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('accepts the email address case-insensitively', async () => {
    const user = await createTestUser('USER', 'Mixed.Case@prometheus-lite.test');

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email.toUpperCase(), password: TEST_PASSWORD })
      .expect(200);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await createTestUser('USER');

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@prometheus-lite.test', password: 'not-the-password' })
      .expect(401);

    const unknownUser = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@prometheus-lite.test', password: 'not-the-password' })
      .expect(401);

    expect(wrongPassword.body).toEqual(unknownUser.body);
  });

  it('records the last login timestamp', async () => {
    const user = await createTestUser('USER');

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);

    const profile = await request(app)
      .get('/api/v1/auth/me')
      .set('authorization', bearer(user.token))
      .expect(200);

    expect(profile.body.data.lastLoginAt).not.toBeNull();
  });

  it('rejects requests without a token', async () => {
    const response = await request(app).get('/api/v1/services').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed authorization header', async () => {
    await request(app).get('/api/v1/services').set('authorization', 'Token abc').expect(401);
    await request(app).get('/api/v1/services').set('authorization', 'Bearer').expect(401);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhQGIuY29tIiwicm9sZSI6IkFETUlOIn0.' +
      'invalid-signature';

    const response = await request(app)
      .get('/api/v1/services')
      .set('authorization', bearer(forged))
      .expect(401);

    expect(response.body.error.message).toMatch(/invalid/i);
  });

  it('rejects a tampered signature', async () => {
    const user = await createTestUser('USER');
    const { token } = signAccessToken({ id: user.id, email: user.email, role: 'USER' });

    const tampered = token.replace(/\.[^.]+$/, '.not-the-signature');
    await request(app).get('/api/v1/services').set('authorization', bearer(tampered)).expect(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ email: 'user@prometheus-lite.test', role: 'USER' }, env.JWT_SECRET, {
      subject: '1',
      issuer: env.JWT_ISSUER,
      expiresIn: -60,
    });

    const response = await request(app)
      .get('/api/v1/services')
      .set('authorization', bearer(expired))
      .expect(401);

    expect(response.body.error.message).toMatch(/expired/i);
  });

  it('returns the current user for a valid token', async () => {
    const user = await createTestUser('ADMIN');

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('authorization', bearer(user.token))
      .expect(200);

    expect(response.body.data).toMatchObject({ email: user.email, role: 'ADMIN' });
  });
});

describe.skipIf(!available)('role based access', () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  const payload = {
    slug: 'checkout-api',
    displayName: 'Checkout API',
    baseUrl: 'http://checkout:8081',
  };

  it('lets a reader list services', async () => {
    const reader = await createTestUser('USER');
    await request(app)
      .get('/api/v1/services')
      .set('authorization', bearer(reader.token))
      .expect(200);
  });

  it('stops a reader from registering a service', async () => {
    const reader = await createTestUser('USER');

    const response = await request(app)
      .post('/api/v1/services')
      .set('authorization', bearer(reader.token))
      .send(payload)
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('stops a reader from deleting a service', async () => {
    const admin = await createTestUser('ADMIN');
    const reader = await createTestUser('USER');

    await request(app)
      .post('/api/v1/services')
      .set('authorization', bearer(admin.token))
      .send(payload)
      .expect(201);

    await request(app)
      .delete('/api/v1/services/checkout-api')
      .set('authorization', bearer(reader.token))
      .expect(403);
  });

  it('lets an admin register a service', async () => {
    const admin = await createTestUser('ADMIN');
    await request(app)
      .post('/api/v1/services')
      .set('authorization', bearer(admin.token))
      .send(payload)
      .expect(201);
  });
});

describe.skipIf(!available)('collector authentication', () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  const batch = {
    collector: 'test',
    snapshots: [
      {
        service: 'checkout-api',
        recordedAt: new Date().toISOString(),
        metrics: { availability: 1 },
      },
    ],
  };

  it('rejects ingestion without the collector token', async () => {
    await request(app).post('/api/v1/ingest/snapshots').send(batch).expect(401);
  });

  it('rejects ingestion with a wrong collector token', async () => {
    await request(app)
      .post('/api/v1/ingest/snapshots')
      .set('authorization', bearer('not-the-collector-token'))
      .send(batch)
      .expect(401);
  });

  it('does not accept a user token for ingestion', async () => {
    const admin = await createTestUser('ADMIN');

    await request(app)
      .post('/api/v1/ingest/snapshots')
      .set('authorization', bearer(admin.token))
      .send(batch)
      .expect(401);
  });

  it('accepts ingestion with the collector token', async () => {
    await request(app)
      .post('/api/v1/ingest/snapshots')
      .set('authorization', bearer(COLLECTOR_TOKEN))
      .send(batch)
      .expect(202);
  });
});
