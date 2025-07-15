import { SnapshotRepository, snapshotRepository } from '../repositories/snapshotRepository.js';
import { SnapshotNormalizer, snapshotNormalizer } from './snapshotNormalizer.js';
import { logger } from '../lib/logger.js';
import type { IngestBatch, IngestOutcome } from '../types/metrics.js';

export const MAX_SNAPSHOTS_PER_BATCH = 500;

export class IngestionService {
  private readonly normalizer: SnapshotNormalizer;
  private readonly snapshots: SnapshotRepository;

  constructor(
    normalizer: SnapshotNormalizer = snapshotNormalizer,
    snapshots: SnapshotRepository = snapshotRepository,
  ) {
    this.normalizer = normalizer;
    this.snapshots = snapshots;
  }

  async ingest(batch: IngestBatch, now: Date = new Date()): Promise<IngestOutcome> {
    const normalized = await this.normalizer.normalize(batch, now);
    const storedPoints = await this.snapshots.insertMany(normalized.points);

    logger.debug(
      {
        collector: batch.collector,
        points: normalized.points.length,
        storedPoints,
        rejected: normalized.rejected.length,
      },
      'ingest batch processed',
    );

    return {
      acceptedSnapshots: normalized.acceptedSnapshots,
      acceptedPoints: normalized.points.length,
      storedPoints,
      rejected: normalized.rejected,
    };
  }
}

export const ingestionService = new IngestionService();
