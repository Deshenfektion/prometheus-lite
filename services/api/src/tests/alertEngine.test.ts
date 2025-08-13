import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlertEngine } from '../services/alertEngine.js';
import { alertEventRepository } from '../repositories/alertEventRepository.js';
import { alertStateRepository } from '../repositories/alertStateRepository.js';
import { databaseAvailable, prepareDatabase, resetDatabase } from './helpers/database.js';
import { createRule, createService, samplesEvery, writeSamples } from './helpers/fixtures.js';

const available = await databaseAvailable();
const engine = new AlertEngine();

const T0 = new Date('2025-04-15T10:00:00.000Z');

function at(secondsAfterT0: number): Date {
  return new Date(T0.getTime() + secondsAfterT0 * 1000);
}

describe.skipIf(!available)('alert engine', () => {
  let serviceId = 0;

  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    serviceId = await createService('checkout-api');
  });

  it('treats the evaluation window as half-open', async () => {
    await createRule({
      name: 'p95',
      metricKey: 'latency_p95_ms',
      warning: 500,
      windowSeconds: 60,
    });
    await writeSamples(serviceId, 'latency_p95_ms', [{ at: at(0), value: 9000 }]);

    expect((await engine.evaluate(at(0))).pairsEvaluated).toBe(0);
    expect((await engine.evaluate(at(1))).pairsEvaluated).toBe(1);
  });

  it('produces no observation when the window has no samples', async () => {
    await createRule({ name: 'p95', metricKey: 'latency_p95_ms', warning: 500 });

    const summary = await engine.evaluate(at(0));

    expect(summary.pairsEvaluated).toBe(0);
    expect(summary.transitions).toBe(0);
  });

  it('fires a warning and opens an event', async () => {
    const ruleId = await createRule({
      name: 'p95',
      metricKey: 'latency_p95_ms',
      warning: 500,
      critical: 1500,
    });
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 6, at(0), 800));

    const summary = await engine.evaluate(at(0));

    expect(summary.transitions).toBe(1);

    const active = await alertStateRepository.listActive();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ ruleId, serviceSlug: 'checkout-api', state: 'WARNING' });

    const events = await alertEventRepository.list();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromState: 'OK', toState: 'WARNING', resolvedAt: null });
  });

  it('stays quiet on the second evaluation of an unchanged breach', async () => {
    await createRule({ name: 'p95', metricKey: 'latency_p95_ms', warning: 500 });
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 6, at(0), 800));

    await engine.evaluate(at(0));
    const second = await engine.evaluate(at(10));

    expect(second.transitions).toBe(0);
    expect(await alertEventRepository.list()).toHaveLength(1);
  });

  it('escalates from warning to critical and reopens the incident', async () => {
    await createRule({
      name: 'p95',
      metricKey: 'latency_p95_ms',
      warning: 500,
      critical: 1500,
      windowSeconds: 30,
    });
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(0), 800));
    await engine.evaluate(at(0));

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(60), 4000));
    const summary = await engine.evaluate(at(60));

    expect(summary.transitions).toBe(1);

    const events = await alertEventRepository.list();
    expect(events[0]).toMatchObject({ fromState: 'WARNING', toState: 'CRITICAL' });
    expect(events[1]?.resolvedAt).not.toBeNull();

    const active = await alertStateRepository.listActive();
    expect(active[0]?.state).toBe('CRITICAL');
  });

  it('recovers, resolves the incident and records the transition', async () => {
    await createRule({
      name: 'p95',
      metricKey: 'latency_p95_ms',
      warning: 500,
      windowSeconds: 30,
    });
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(0), 800));
    await engine.evaluate(at(0));

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(60), 90));
    const summary = await engine.evaluate(at(60));

    expect(summary.transitions).toBe(1);
    expect(await alertStateRepository.listActive()).toHaveLength(0);

    const events = await alertEventRepository.list();
    expect(events[0]).toMatchObject({ fromState: 'WARNING', toState: 'OK' });
    expect(events[1]?.resolvedAt).not.toBeNull();
  });

  it('waits out the hold-down before firing', async () => {
    await createRule({
      name: 'p95',
      metricKey: 'latency_p95_ms',
      warning: 500,
      windowSeconds: 30,
      forSeconds: 120,
    });

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(0), 800));
    expect((await engine.evaluate(at(0))).transitions).toBe(0);

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(60), 800));
    expect((await engine.evaluate(at(60))).transitions).toBe(0);

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(130), 800));
    expect((await engine.evaluate(at(130))).transitions).toBe(1);

    expect(await alertStateRepository.listActive()).toHaveLength(1);
  });

  it('abandons the hold-down when the breach clears', async () => {
    await createRule({
      name: 'p95',
      metricKey: 'latency_p95_ms',
      warning: 500,
      windowSeconds: 30,
      forSeconds: 120,
    });

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(0), 800));
    await engine.evaluate(at(0));

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(60), 100));
    await engine.evaluate(at(60));

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 3, at(130), 800));
    expect((await engine.evaluate(at(130))).transitions).toBe(0);
    expect(await alertStateRepository.listActive()).toHaveLength(0);
  });

  it('detects downtime with a BELOW rule', async () => {
    await createRule({
      name: 'unreachable',
      metricKey: 'availability',
      comparison: 'BELOW',
      warning: 0.99,
      critical: 0.5,
      windowSeconds: 60,
    });
    await writeSamples(serviceId, 'availability', samplesEvery(10, 6, at(0), 0));

    await engine.evaluate(at(0));

    const active = await alertStateRepository.listActive();
    expect(active[0]).toMatchObject({ state: 'CRITICAL', metricKey: 'availability' });
  });

  it('leaves a fully available service alone', async () => {
    await createRule({
      name: 'unreachable',
      metricKey: 'availability',
      comparison: 'BELOW',
      warning: 0.99,
      critical: 0.5,
    });
    await writeSamples(serviceId, 'availability', samplesEvery(10, 6, at(0), 1));

    const summary = await engine.evaluate(at(0));

    expect(summary.pairsEvaluated).toBe(1);
    expect(summary.transitions).toBe(0);
  });

  it('only evaluates the service a scoped rule targets', async () => {
    const otherId = await createService('search-api');
    await createRule({
      name: 'p95 for search only',
      metricKey: 'latency_p95_ms',
      serviceId: otherId,
      warning: 500,
    });

    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 6, at(0), 5000));
    await writeSamples(otherId, 'latency_p95_ms', samplesEvery(10, 6, at(0), 5000));

    const summary = await engine.evaluate(at(0));

    expect(summary.pairsEvaluated).toBe(1);
    const active = await alertStateRepository.listActive();
    expect(active[0]?.serviceSlug).toBe('search-api');
  });

  it('skips disabled rules', async () => {
    await createRule({
      name: 'p95',
      metricKey: 'latency_p95_ms',
      warning: 500,
      enabled: false,
    });
    await writeSamples(serviceId, 'latency_p95_ms', samplesEvery(10, 6, at(0), 5000));

    expect((await engine.evaluate(at(0))).pairsEvaluated).toBe(0);
  });

  it('respects the aggregation a rule asks for', async () => {
    await createRule({
      name: 'max latency',
      metricKey: 'latency_p95_ms',
      aggregation: 'max',
      warning: 500,
      windowSeconds: 200,
    });
    await createRule({
      name: 'avg latency',
      metricKey: 'latency_p95_ms',
      aggregation: 'avg',
      warning: 500,
      windowSeconds: 200,
    });

    await writeSamples(
      serviceId,
      'latency_p95_ms',
      samplesEvery(10, 20, at(-10), (index) => (index === 19 ? 3000 : 10)),
    );

    await engine.evaluate(at(0));

    const active = await alertStateRepository.listActive();
    expect(active.map((alert) => alert.ruleName)).toEqual(['max latency']);
  });
});
