import type { SnapshotRepository } from '../repositories/snapshotRepository.js';
import { snapshotRepository } from '../repositories/snapshotRepository.js';
import type { ServiceDirectory } from './serviceDirectory.js';
import { serviceDirectory } from './serviceDirectory.js';
import type { MetricCatalog } from './metricCatalog.js';
import { metricCatalog } from './metricCatalog.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { chooseStep, snapStep } from '../lib/buckets.js';
import { detectAnomalies } from './anomalyDetector.js';
import type { AnomalyOptions } from './anomalyDetector.js';
import type { Anomaly } from './anomalyDetector.js';
import type { MetricDefinition } from '../types/metrics.js';
import type {
  AggregateRequest,
  HistoryRequest,
  MetricSeries,
  SeriesPoint,
} from '../types/query.js';

export const MAX_WINDOW_SECONDS = 7 * 24 * 3600;
export const MAX_POINTS = 5_000;
export const DEFAULT_WINDOW_SECONDS = 3600;

export interface HistoryOptions {
  slug: string;
  metricKeys?: string[];
  from?: Date;
  to?: Date;
  limit?: number;
  stepSeconds?: number;
}

export interface AnnotatedSeries extends MetricSeries {
  anomalies: Anomaly[];
}

export class MetricsService {
  private readonly directory: ServiceDirectory;
  private readonly snapshots: SnapshotRepository;
  private readonly catalog: MetricCatalog;

  constructor(
    directory: ServiceDirectory = serviceDirectory,
    snapshots: SnapshotRepository = snapshotRepository,
    catalog: MetricCatalog = metricCatalog,
  ) {
    this.directory = directory;
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

  async history(options: HistoryOptions): Promise<MetricSeries[]> {
    const service = await this.directory.resolve(options.slug);
    if (service === undefined) {
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
    const metricIds = definitions.map((definition) => definition.id);
    const limit = Math.min(options.limit ?? MAX_POINTS, MAX_POINTS);
    const windowSeconds = (to.getTime() - from.getTime()) / 1000;
    const pointBudget = Math.max(Math.floor(limit / Math.max(definitions.length, 1)), 1);

    const stepSeconds =
      options.stepSeconds === undefined
        ? chooseStep(windowSeconds, pointBudget)
        : snapStep(options.stepSeconds);

    const request = { serviceId: service.id, metricIds, from, to, limit };
    const pointsByMetric =
      stepSeconds === null
        ? await this.rawPoints(request)
        : await this.bucketedPoints({ ...request, stepSeconds });

    return definitions.map((definition) => ({
      service: service.slug,
      metric: definition.key,
      unit: definition.unit,
      stepSeconds,
      points: pointsByMetric.get(definition.id) ?? [],
    }));
  }

  async historyWithAnomalies(
    options: HistoryOptions,
    detection: Partial<AnomalyOptions> = {},
  ): Promise<AnnotatedSeries[]> {
    const series = await this.history(options);

    return series.map((entry) => ({
      ...entry,
      anomalies: detectAnomalies(entry.points, detection),
    }));
  }

  private async rawPoints(request: HistoryRequest): Promise<Map<number, SeriesPoint[]>> {
    const rows = await this.snapshots.history(request);
    const grouped = new Map<number, SeriesPoint[]>();

    for (const row of rows) {
      const points = grouped.get(row.metricId) ?? [];
      points.push({ recordedAt: row.recordedAt, value: row.value });
      grouped.set(row.metricId, points);
    }

    return grouped;
  }

  private async bucketedPoints(request: AggregateRequest): Promise<Map<number, SeriesPoint[]>> {
    const rows = await this.snapshots.aggregate(request);
    const grouped = new Map<number, SeriesPoint[]>();

    for (const row of rows) {
      const points = grouped.get(row.metricId) ?? [];
      points.push({
        recordedAt: row.bucketStart,
        value: row.average,
        min: row.minimum,
        max: row.maximum,
        samples: row.samples,
      });
      grouped.set(row.metricId, points);
    }

    return grouped;
  }
}

export const metricsService = new MetricsService();
