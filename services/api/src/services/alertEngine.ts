import type { AlertRuleRepository } from '../repositories/alertRuleRepository.js';
import { alertRuleRepository } from '../repositories/alertRuleRepository.js';
import type { AlertEventRepository } from '../repositories/alertEventRepository.js';
import { alertEventRepository } from '../repositories/alertEventRepository.js';
import type { AlertStateRepository } from '../repositories/alertStateRepository.js';
import { alertStateRepository, stateKey } from '../repositories/alertStateRepository.js';
import type { SnapshotRepository } from '../repositories/snapshotRepository.js';
import { snapshotRepository } from '../repositories/snapshotRepository.js';
import type { ServiceDirectory } from './serviceDirectory.js';
import { serviceDirectory } from './serviceDirectory.js';
import { describeBreach, evaluateThreshold } from './alertEvaluator.js';
import { logger } from '../lib/logger.js';
import type {
  ActiveAlert,
  AlertRule,
  AlertState,
  AlertStateRecord,
  EvaluationSummary,
} from '../types/alerts.js';

export interface Observation {
  rule: AlertRule;
  serviceId: number;
  serviceSlug: string;
  value: number;
  samples: number;
  state: AlertState;
  threshold: number | null;
}

export interface Transition {
  ruleId: number;
  ruleName: string;
  serviceId: number;
  serviceSlug: string;
  from: AlertState;
  to: AlertState;
  value: number;
  message: string;
}

export class AlertEngine {
  private readonly rules: AlertRuleRepository;
  private readonly snapshots: SnapshotRepository;
  private readonly states: AlertStateRepository;
  private readonly events: AlertEventRepository;
  private readonly directory: ServiceDirectory;

  constructor(
    rules: AlertRuleRepository = alertRuleRepository,
    snapshots: SnapshotRepository = snapshotRepository,
    states: AlertStateRepository = alertStateRepository,
    events: AlertEventRepository = alertEventRepository,
    directory: ServiceDirectory = serviceDirectory,
  ) {
    this.rules = rules;
    this.snapshots = snapshots;
    this.states = states;
    this.events = events;
    this.directory = directory;
  }

  async observe(now: Date = new Date()): Promise<Observation[]> {
    const [rules, services] = await Promise.all([this.rules.list(true), this.directory.all()]);
    const slugById = new Map(services.map((service) => [service.id, service.slug]));
    const enabledIds = new Set(
      services.filter((service) => service.enabled).map((service) => service.id),
    );

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

  private async applyTransition(
    observation: Observation,
    previous: AlertState,
    now: Date,
  ): Promise<Transition> {
    const { rule } = observation;
    const message = describeBreach(
      rule,
      { state: observation.state, threshold: observation.threshold },
      observation.value,
    );

    await this.events.resolveOpen(rule.id, observation.serviceId, now);
    await this.events.insert({
      ruleId: rule.id,
      serviceId: observation.serviceId,
      fromState: previous,
      toState: observation.state,
      value: observation.value,
      threshold: observation.threshold,
      message,
      occurredAt: now,
      resolvedAt: observation.state === 'OK' ? now : null,
    });

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      serviceId: observation.serviceId,
      serviceSlug: observation.serviceSlug,
      from: previous,
      to: observation.state,
      value: observation.value,
      message,
    };
  }

  async evaluate(now: Date = new Date()): Promise<EvaluationSummary> {
    const started = Date.now();
    const observations = await this.observe(now);
    const existing = await this.states.loadAll();
    const transitions: Transition[] = [];

    for (const observation of observations) {
      const key = stateKey(observation.rule.id, observation.serviceId);
      const previous: AlertStateRecord | undefined = existing.get(key);
      const previousState = previous?.state ?? 'OK';
      const changed = previousState !== observation.state;

      if (changed) {
        transitions.push(await this.applyTransition(observation, previousState, now));
      }

      await this.states.upsert({
        ruleId: observation.rule.id,
        serviceId: observation.serviceId,
        state: observation.state,
        since: changed ? now : new Date(previous?.since ?? now.toISOString()),
        pendingState: null,
        pendingSince: null,
        lastValue: observation.value,
        evaluatedAt: now,
      });
    }

    for (const transition of transitions) {
      logger.info(
        {
          rule: transition.ruleName,
          target: transition.serviceSlug,
          from: transition.from,
          to: transition.to,
        },
        transition.to === 'OK' ? 'alert recovered' : 'alert fired',
      );
    }

    return {
      evaluatedAt: now.toISOString(),
      rulesEvaluated: new Set(observations.map((observation) => observation.rule.id)).size,
      pairsEvaluated: observations.length,
      transitions: transitions.length,
      durationMs: Date.now() - started,
    };
  }

  async active(): Promise<ActiveAlert[]> {
    return this.states.listActive();
  }
}

export const alertEngine = new AlertEngine();
