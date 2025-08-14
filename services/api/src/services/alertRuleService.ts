import type { AlertRuleRepository } from '../repositories/alertRuleRepository.js';
import { alertRuleRepository } from '../repositories/alertRuleRepository.js';
import type { AlertEventRepository, EventFilter } from '../repositories/alertEventRepository.js';
import { alertEventRepository } from '../repositories/alertEventRepository.js';
import type { MetricCatalog } from './metricCatalog.js';
import { metricCatalog } from './metricCatalog.js';
import type { ServiceRepository } from '../repositories/serviceRepository.js';
import { serviceRepository } from '../repositories/serviceRepository.js';
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from '../lib/errors.js';
import type {
  AlertEvent,
  AlertRule,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from '../types/alerts.js';

export class AlertRuleService {
  private readonly rules: AlertRuleRepository;
  private readonly eventLog: AlertEventRepository;
  private readonly catalog: MetricCatalog;
  private readonly services: ServiceRepository;

  constructor(
    rules: AlertRuleRepository = alertRuleRepository,
    events: AlertEventRepository = alertEventRepository,
    catalog: MetricCatalog = metricCatalog,
    services: ServiceRepository = serviceRepository,
  ) {
    this.rules = rules;
    this.eventLog = events;
    this.catalog = catalog;
    this.services = services;
  }

  private async resolveServiceId(slug: string | null | undefined): Promise<number | null> {
    if (slug === null || slug === undefined || slug.length === 0) {
      return null;
    }

    const service = await this.services.findBySlug(slug);
    if (service === null) {
      throw new NotFoundError('Service', slug);
    }
    return service.id;
  }

  private static assertThresholds(input: {
    warningThreshold?: number | null;
    criticalThreshold?: number | null;
  }): void {
    const warning = input.warningThreshold ?? null;
    const critical = input.criticalThreshold ?? null;

    if (warning === null && critical === null) {
      throw new ValidationError('A rule needs a warning threshold, a critical threshold, or both');
    }
  }

  async list(): Promise<AlertRule[]> {
    return this.rules.list();
  }

  async get(id: number): Promise<AlertRule> {
    const rule = await this.rules.findById(id);
    if (rule === null) {
      throw new NotFoundError('Alert rule', id);
    }
    return rule;
  }

  async create(input: CreateAlertRuleInput): Promise<AlertRule> {
    AlertRuleService.assertThresholds(input);

    const definition = await this.catalog.resolveKey(input.metricKey);
    if (definition === undefined) {
      throw new ValidationError(`Unknown metric '${input.metricKey}'`);
    }

    const serviceId = await this.resolveServiceId(input.serviceSlug);

    try {
      return await this.rules.create({ ...input, metricId: definition.id, serviceId });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`An alert rule named '${input.name}' already exists`);
      }
      throw error;
    }
  }

  async update(id: number, patch: UpdateAlertRuleInput): Promise<AlertRule> {
    const existing = await this.get(id);

    AlertRuleService.assertThresholds({
      warningThreshold:
        patch.warningThreshold === undefined ? existing.warningThreshold : patch.warningThreshold,
      criticalThreshold:
        patch.criticalThreshold === undefined
          ? existing.criticalThreshold
          : patch.criticalThreshold,
    });

    const serviceId =
      patch.serviceSlug === undefined ? undefined : await this.resolveServiceId(patch.serviceSlug);

    const updated = await this.rules.update(id, {
      ...patch,
      ...(serviceId === undefined ? {} : { serviceId }),
    });

    if (updated === null) {
      throw new NotFoundError('Alert rule', id);
    }
    return updated;
  }

  async remove(id: number): Promise<void> {
    const removed = await this.rules.remove(id);
    if (!removed) {
      throw new NotFoundError('Alert rule', id);
    }
  }

  async events(filter: EventFilter): Promise<AlertEvent[]> {
    return this.eventLog.list(filter);
  }
}

export const alertRuleService = new AlertRuleService();
