import type { MetricCatalog } from './metricCatalog.js';
import { metricCatalog } from './metricCatalog.js';
import type { ServiceDirectory } from './serviceDirectory.js';
import { serviceDirectory } from './serviceDirectory.js';
import { validateMetricValue } from './metricValidation.js';
import { TimestampError, normalizeTimestamp } from '../lib/time.js';
import type {
  IngestBatch,
  IngestSnapshot,
  MetricPoint,
  RejectedSnapshot,
} from '../types/metrics.js';
import type { MetricDefinition } from '../types/metrics.js';

export interface NormalizedBatch {
  points: MetricPoint[];
  acceptedSnapshots: number;
  rejected: RejectedSnapshot[];
}

export class SnapshotNormalizer {
  private readonly directory: ServiceDirectory;
  private readonly catalog: MetricCatalog;

  constructor(
    directory: ServiceDirectory = serviceDirectory,
    catalog: MetricCatalog = metricCatalog,
  ) {
    this.directory = directory;
    this.catalog = catalog;
  }

  async normalize(batch: IngestBatch, now: Date): Promise<NormalizedBatch> {
    const services = await this.directory.all();
    const serviceIds = new Map(services.map((service) => [service.slug, service.id]));
    const definitions = await this.catalog.all();
    const metrics = new Map(definitions.map((definition) => [definition.key, definition]));

    const points: MetricPoint[] = [];
    const rejected: RejectedSnapshot[] = [];
    let acceptedSnapshots = 0;

    for (const [index, snapshot] of batch.snapshots.entries()) {
      const serviceId = serviceIds.get(snapshot.service);
      if (serviceId === undefined) {
        rejected.push({ index, service: snapshot.service, reason: 'unknown service' });
        continue;
      }

      let recordedAt: Date;
      try {
        recordedAt = normalizeTimestamp(snapshot.recordedAt, now);
      } catch (error) {
        rejected.push({
          index,
          service: snapshot.service,
          reason: error instanceof TimestampError ? error.message : 'invalid timestamp',
        });
        continue;
      }

      const { accepted, problems } = this.expand(snapshot, serviceId, recordedAt, metrics);

      if (problems.length > 0) {
        rejected.push({ index, service: snapshot.service, reason: problems.join('; ') });
      }
      if (accepted.length === 0) {
        continue;
      }

      points.push(...accepted);
      acceptedSnapshots += 1;
    }

    return { points, acceptedSnapshots, rejected };
  }

  private expand(
    snapshot: IngestSnapshot,
    serviceId: number,
    recordedAt: Date,
    metrics: Map<string, MetricDefinition>,
  ): { accepted: MetricPoint[]; problems: string[] } {
    const accepted: MetricPoint[] = [];
    const problems: string[] = [];

    for (const [key, value] of Object.entries(snapshot.metrics)) {
      const definition = metrics.get(key);
      if (definition === undefined) {
        problems.push(`unknown metric '${key}'`);
        continue;
      }

      const problem = validateMetricValue(definition, value);
      if (problem !== undefined) {
        problems.push(problem);
        continue;
      }

      accepted.push({ serviceId, metricId: definition.id, recordedAt, value });
    }

    return { accepted, problems };
  }
}

export const snapshotNormalizer = new SnapshotNormalizer();
