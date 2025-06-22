import { ServiceRepository, serviceRepository } from '../repositories/serviceRepository.js';
import { SnapshotRepository, snapshotRepository } from '../repositories/snapshotRepository.js';
import { MetricCatalog, metricCatalog } from './metricCatalog.js';
import { validateMetricValue } from './metricValidation.js';
import { TimestampError, normalizeTimestamp } from '../lib/time.js';
import { logger } from '../lib/logger.js';
import type {
  IngestBatch,
  IngestOutcome,
  MetricPoint,
  RejectedSnapshot,
} from '../types/metrics.js';

export const MAX_SNAPSHOTS_PER_BATCH = 500;

export class IngestionService {
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

  async ingest(batch: IngestBatch, now: Date = new Date()): Promise<IngestOutcome> {
    const registered = await this.services.list();
    const serviceIds = new Map(registered.map((service) => [service.slug, service.id]));

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

      const snapshotPoints: MetricPoint[] = [];
      const problems: string[] = [];

      for (const [key, value] of Object.entries(snapshot.metrics)) {
        const definition = await this.catalog.resolveKey(key);
        if (definition === undefined) {
          problems.push(`unknown metric '${key}'`);
          continue;
        }

        const problem = validateMetricValue(definition, value);
        if (problem !== undefined) {
          problems.push(problem);
          continue;
        }

        snapshotPoints.push({
          serviceId,
          metricId: definition.id,
          recordedAt,
          value,
        });
      }

      if (problems.length > 0) {
        rejected.push({
          index,
          service: snapshot.service,
          reason: problems.join('; '),
        });
      }

      if (snapshotPoints.length === 0) {
        continue;
      }

      points.push(...snapshotPoints);
      acceptedSnapshots += 1;
    }

    const written = await this.snapshots.insertMany(points);

    logger.debug(
      {
        collector: batch.collector,
        points: points.length,
        written,
        rejected: rejected.length,
      },
      'ingest batch processed',
    );

    return {
      acceptedSnapshots,
      acceptedPoints: points.length,
      storedPoints: written,
      rejected,
    };
  }
}

export const ingestionService = new IngestionService();
