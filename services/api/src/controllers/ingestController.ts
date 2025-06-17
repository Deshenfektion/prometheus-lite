import type { Request, Response } from 'express';
import { z } from 'zod';
import { MAX_SNAPSHOTS_PER_BATCH, ingestionService } from '../services/ingestionService.js';
import { parseBody } from '../lib/validation.js';

const metricValue = z
  .number()
  .finite()
  .refine((value) => Math.abs(value) < 1e12, 'metric value out of range');

const snapshotSchema = z.object({
  service: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  recordedAt: z.string().min(20).max(40),
  metrics: z.record(z.string().regex(/^[a-z][a-z0-9_]{1,62}$/), metricValue).refine(
    (metrics) => Object.keys(metrics).length > 0,
    'at least one metric is required',
  ),
});

const batchSchema = z.object({
  collector: z.string().min(1).max(64),
  snapshots: z.array(snapshotSchema).min(1).max(MAX_SNAPSHOTS_PER_BATCH),
});

export async function ingestSnapshots(req: Request, res: Response): Promise<void> {
  const batch = parseBody(batchSchema, req);
  const outcome = await ingestionService.ingest(batch);

  res.status(202).json({ data: outcome });
}
