import { SnapshotRepository, snapshotRepository } from '../repositories/snapshotRepository.js';
import { ServiceRepository, serviceRepository } from '../repositories/serviceRepository.js';
import { MetricCatalog, metricCatalog } from './metricCatalog.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { MetricDefinition } from '../types/metrics.js';
import type { MetricSeries, SeriesPoint } from '../types/query.js';

export const MAX_WINDOW_SECONDS = 7 * 24 * 3600;
export const MAX_POINTS = 5_000;
export const DEFAULT_WINDOW_SECONDS = 3600;

export interface HistoryOptions {
  slug: string;
  metricKeys?: string[];
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface LatestSnapshot {
  service: string;
  metrics: Record<string, { value: number; recordedAt: string }>;
}

export class MetricsService {
  private readonly services: ServiceRepository;
  private readonly snapshots: SnapshotRepository;
  private readonly catalog: MetricCatalog;

  constructor(
    services: ServiceRepository = serviceRepository,
    snapshots: SnapshotRepository = snapshotRepository,
    catalog: MetricCatalog = metricCatalog,
  ) {
    this.services = services;
    this.snapshots = snapshots;
    this.catalog = catalog;
  }

  async definitions(): Promise<MetricDefinition[]> {
    return this.catalog.all();
  }

  private async resolveMetrics(keys: string[] | undefined): Promise<MetricDefinition[]> {
    const definitions = await this.catalog.all();
    if (keys === undefined || keys.length === 0) {
      return definitions;
    }

    const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const resolved: MetricDefinition[] = [];
    const unknown: string[] = [];

    for (const key of keys) {
      const definition = byKey.get(key);
      if (definition === undefined) {
        unknown.push(key);
        continue;
      }
      resolved.push(definition);
    }

    if (unknown.length > 0) {
      throw new ValidationError(`Unknown metric keys: ${unknown.join(', ')}`);
    }

    return resolved;
  }

  async latest(): Promise<LatestSnapshot[]> {
    const services = await this.services.list();
    if (services.length === 0) {
      return [];
    }

    const definitions = await this.catalog.all();
    const keyById = new Map(definitions.map((definition) => [definition.id, definition.key]));
    const slugById = new Map(services.map((service) => [service.id, service.slug]));

    const values = await this.snapshots.latestValues(services.map((service) => service.id));
    const bySlug = new Map<string, LatestSnapshot>(
      services.map((service) => [service.slug, { service: service.slug, metrics: {} }]),
    );

    for (const value of values) {
      const slug = slugById.get(value.serviceId);
      const key = keyById.get(value.metricId);
      if (slug === undefined || key === undefined) {
        continue;
      }
      const entry = bySlug.get(slug);
      if (entry !== undefined) {
        entry.metrics[key] = { value: value.value, recordedAt: value.recordedAt };
      }
    }

    return [...bySlug.values()];
  }

  async history(options: HistoryOptions): Promise<MetricSeries[]> {
    const service = await this.services.findBySlug(options.slug);
    if (service === null) {
      throw new NotFoundError('Service', options.slug);
    }

    const to = options.to ?? new Date();
    const from = options.from ?? new Date(to.getTime() - DEFAULT_WINDOW_SECONDS * 1000);

    if (from >= to) {
      throw new ValidationError("'from' must be earlier than 'to'");
    }
    if (to.getTime() - from.getTime() > MAX_WINDOW_SECONDS * 1000) {
      throw new ValidationError(`Requested window exceeds ${MAX_WINDOW_SECONDS} seconds`);
    }

    const definitions = await this.resolveMetrics(options.metricKeys);
    const limit = Math.min(options.limit ?? MAX_POINTS, MAX_POINTS);

    const rows = await this.snapshots.history({
      serviceId: service.id,
      metricIds: definitions.map((definition) => definition.id),
      from,
      to,
      limit,
    });

    const pointsByMetric = new Map<number, SeriesPoint[]>();
    for (const row of rows) {
      const points = pointsByMetric.get(row.metricId) ?? [];
      points.push({ recordedAt: row.recordedAt, value: row.value });
      pointsByMetric.set(row.metricId, points);
    }

    return definitions.map((definition) => ({
      service: service.slug,
      metric: definition.key,
      unit: definition.unit,
      points: pointsByMetric.get(definition.id) ?? [],
    }));
  }
}

export const metricsService = new MetricsService();
