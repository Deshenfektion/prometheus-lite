import type { AlertRuleRepository } from '../repositories/alertRuleRepository.js';
import { alertRuleRepository } from '../repositories/alertRuleRepository.js';
import type { SnapshotRepository } from '../repositories/snapshotRepository.js';
import { snapshotRepository } from '../repositories/snapshotRepository.js';
import type { ServiceDirectory } from './serviceDirectory.js';
import { serviceDirectory } from './serviceDirectory.js';
import { evaluateThreshold } from './alertEvaluator.js';
import { logger } from '../lib/logger.js';
import type { AlertRule, AlertState, EvaluationSummary } from '../types/alerts.js';

export interface Observation {
  rule: AlertRule;
  serviceId: number;
  serviceSlug: string;
  value: number;
  samples: number;
  state: AlertState;
  threshold: number | null;
}

export class AlertEngine {
  private readonly rules: AlertRuleRepository;
  private readonly snapshots: SnapshotRepository;
  private readonly directory: ServiceDirectory;

  constructor(
    rules: AlertRuleRepository = alertRuleRepository,
    snapshots: SnapshotRepository = snapshotRepository,
    directory: ServiceDirectory = serviceDirectory,
  ) {
    this.rules = rules;
    this.snapshots = snapshots;
    this.directory = directory;
  }

  async observe(now: Date = new Date()): Promise<Observation[]> {
    const [rules, services] = await Promise.all([this.rules.list(true), this.directory.all()]);
    const slugById = new Map(services.map((service) => [service.id, service.slug]));
    const enabledIds = new Set(services.filter((service) => service.enabled).map((s) => s.id));

    const observations: Observation[] = [];

    for (const rule of rules) {
      const scoped =
        rule.serviceId === null
          ? [...enabledIds]
          : enabledIds.has(rule.serviceId)
            ? [rule.serviceId]
            : [];

      if (scoped.length === 0) {
        continue;
      }

      const aggregates = await this.snapshots.windowAggregate({
        metricId: rule.metricId,
        aggregation: rule.aggregation,
        from: new Date(now.getTime() - rule.windowSeconds * 1000),
        to: now,
        serviceIds: scoped,
      });

      for (const aggregate of aggregates) {
        const slug = slugById.get(aggregate.serviceId);
        if (slug === undefined) {
          continue;
        }

        const verdict = evaluateThreshold(rule, aggregate.value);
        observations.push({
          rule,
          serviceId: aggregate.serviceId,
          serviceSlug: slug,
          value: aggregate.value,
          samples: aggregate.samples,
          state: verdict.state,
          threshold: verdict.threshold,
        });
      }
    }

    return observations;
  }

  async evaluate(now: Date = new Date()): Promise<EvaluationSummary> {
    const started = Date.now();
    const observations = await this.observe(now);
    const breaching = observations.filter((observation) => observation.state !== 'OK');

    if (breaching.length > 0) {
      logger.debug({ breaching: breaching.length }, 'alert rules breaching');
    }

    return {
      evaluatedAt: now.toISOString(),
      rulesEvaluated: new Set(observations.map((observation) => observation.rule.id)).size,
      pairsEvaluated: observations.length,
      transitions: 0,
      durationMs: Date.now() - started,
    };
  }
}

export const alertEngine = new AlertEngine();
