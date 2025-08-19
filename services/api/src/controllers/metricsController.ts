import type { Request, Response } from 'express';
import { z } from 'zod';
import { MAX_POINTS, metricsService } from '../services/metricsService.js';
import { parseQuery } from '../lib/validation.js';

const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const csvKeys = z.string().transform((value) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean),
);

const historyQuery = z.object({
  service: z.string().min(2).max(63),
  metrics: csvKeys.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_POINTS).optional(),
  step: z.coerce.number().int().min(1).max(86_400).optional(),
});

export async function listMetricDefinitions(_req: Request, res: Response): Promise<void> {
  const definitions = await metricsService.definitions();
  res.json({ data: definitions });
}

export async function getLatestMetrics(_req: Request, res: Response): Promise<void> {
  const latest = await metricsService.latest();
  res.json({ data: latest });
}

const anomalyQuery = historyQuery.extend({
  window: z.coerce.number().int().min(5).max(500).optional(),
  threshold: z.coerce.number().min(1).max(20).optional(),
  method: z.enum(['zscore', 'modified-zscore']).optional(),
});

export async function getMetricAnomalies(req: Request, res: Response): Promise<void> {
  const params = parseQuery(anomalyQuery, req);

  const series = await metricsService.historyWithAnomalies(
    {
      slug: params.service,
      ...(params.metrics === undefined ? {} : { metricKeys: params.metrics }),
      ...(params.from === undefined ? {} : { from: params.from }),
      ...(params.to === undefined ? {} : { to: params.to }),
      ...(params.limit === undefined ? {} : { limit: params.limit }),
      ...(params.step === undefined ? {} : { stepSeconds: params.step }),
    },
    {
      ...(params.window === undefined ? {} : { windowSize: params.window }),
      ...(params.threshold === undefined ? {} : { threshold: params.threshold }),
      ...(params.method === undefined ? {} : { method: params.method }),
    },
  );

  res.json({ data: series });
}

export async function getMetricHistory(req: Request, res: Response): Promise<void> {
  const params = parseQuery(historyQuery, req);
  const series = await metricsService.history({
    slug: params.service,
    ...(params.metrics === undefined ? {} : { metricKeys: params.metrics }),
    ...(params.from === undefined ? {} : { from: params.from }),
    ...(params.to === undefined ? {} : { to: params.to }),
    ...(params.limit === undefined ? {} : { limit: params.limit }),
    ...(params.step === undefined ? {} : { stepSeconds: params.step }),
  });

  res.json({ data: series });
}
