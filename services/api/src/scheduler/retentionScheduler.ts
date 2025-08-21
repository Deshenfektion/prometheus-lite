import { IntervalRunner } from './intervalRunner.js';
import { retentionService } from '../services/retentionService.js';
import { env } from '../config/env.js';

export function createRetentionScheduler(): IntervalRunner {
  return new IntervalRunner({
    name: 'retention',
    intervalMs: env.RETENTION_INTERVAL_MINUTES * 60_000,
    runOnStart: false,
    task: async () => {
      await retentionService.prune({
        snapshotRetentionDays: env.RETENTION_SNAPSHOT_DAYS,
        eventRetentionDays: env.RETENTION_EVENT_DAYS,
        chunkSize: env.RETENTION_CHUNK_SIZE,
        maxChunks: env.RETENTION_MAX_CHUNKS,
      });
    },
  });
}
