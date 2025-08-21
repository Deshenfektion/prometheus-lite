import { pool } from '../db/pool.js';
import type { Queryable } from '../db/queryable.js';
import { logger } from '../lib/logger.js';

export interface RetentionOptions {
  snapshotRetentionDays: number;
  eventRetentionDays: number;
  chunkSize: number;
  maxChunks: number;
}

export interface RetentionReport {
  snapshotsDeleted: number;
  eventsDeleted: number;
  chunksRun: number;
  reachedLimit: boolean;
  durationMs: number;
}

export class RetentionService {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  private async deleteSnapshotChunk(cutoff: Date, chunkSize: number): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM metric_snapshots
        WHERE ctid IN (
          SELECT ctid FROM metric_snapshots
           WHERE recorded_at < $1
           LIMIT $2
        )`,
      [cutoff, chunkSize],
    );
    return result.rowCount ?? 0;
  }

  private async deleteResolvedEvents(cutoff: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM alert_events
        WHERE occurred_at < $1
          AND resolved_at IS NOT NULL`,
      [cutoff],
    );
    return result.rowCount ?? 0;
  }

  async prune(options: RetentionOptions, now: Date = new Date()): Promise<RetentionReport> {
    const started = Date.now();
    const snapshotCutoff = new Date(now.getTime() - options.snapshotRetentionDays * 86_400_000);
    const eventCutoff = new Date(now.getTime() - options.eventRetentionDays * 86_400_000);

    let snapshotsDeleted = 0;
    let chunksRun = 0;
    let reachedLimit = false;

    for (let chunk = 0; chunk < options.maxChunks; chunk += 1) {
      const deleted = await this.deleteSnapshotChunk(snapshotCutoff, options.chunkSize);
      chunksRun += 1;
      snapshotsDeleted += deleted;

      if (deleted < options.chunkSize) {
        break;
      }
      if (chunk === options.maxChunks - 1) {
        reachedLimit = true;
      }
    }

    const eventsDeleted = await this.deleteResolvedEvents(eventCutoff);
    const report: RetentionReport = {
      snapshotsDeleted,
      eventsDeleted,
      chunksRun,
      reachedLimit,
      durationMs: Date.now() - started,
    };

    if (snapshotsDeleted > 0 || eventsDeleted > 0) {
      logger.info(report, 'retention pass completed');
    }
    if (reachedLimit) {
      logger.warn(
        { chunkSize: options.chunkSize, maxChunks: options.maxChunks },
        'retention hit its chunk budget, backlog remains',
      );
    }

    return report;
  }
}

export const retentionService = new RetentionService();
