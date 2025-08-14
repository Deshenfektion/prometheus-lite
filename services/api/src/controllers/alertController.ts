import type { Request, Response } from 'express';
import { z } from 'zod';
import { alertEngine } from '../services/alertEngine.js';
import { alertRuleService } from '../services/alertRuleService.js';
import { parseBody, parseParams, parseQuery } from '../lib/validation.js';

const idParams = z.object({
  id: z.coerce.number().int().positive(),
});

const ruleBody = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  serviceSlug: z.string().min(2).max(63).nullable().optional(),
  metricKey: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
  comparison: z.enum(['ABOVE', 'BELOW']).optional(),
  aggregation: z.enum(['avg', 'max', 'min', 'last']).optional(),
  windowSeconds: z.number().int().min(10).max(86_400).optional(),
  forSeconds: z.number().int().min(0).max(86_400).optional(),
  warningThreshold: z.number().finite().nullable().optional(),
  criticalThreshold: z.number().finite().nullable().optional(),
  enabled: z.boolean().optional(),
});

const rulePatch = ruleBody.omit({ metricKey: true }).partial();

const eventQuery = z.object({
  service: z.string().min(2).max(63).optional(),
  state: z.enum(['OK', 'WARNING', 'CRITICAL']).optional(),
  since: z
    .string()
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function listAlertRules(_req: Request, res: Response): Promise<void> {
  res.json({ data: await alertRuleService.list() });
}

export async function createAlertRule(req: Request, res: Response): Promise<void> {
  const rule = await alertRuleService.create(parseBody(ruleBody, req));
  res.status(201).json({ data: rule });
}

export async function updateAlertRule(req: Request, res: Response): Promise<void> {
  const { id } = parseParams(idParams, req);
  const rule = await alertRuleService.update(id, parseBody(rulePatch, req));
  res.json({ data: rule });
}

export async function deleteAlertRule(req: Request, res: Response): Promise<void> {
  const { id } = parseParams(idParams, req);
  await alertRuleService.remove(id);
  res.status(204).send();
}

export async function listActiveAlerts(_req: Request, res: Response): Promise<void> {
  res.json({ data: await alertEngine.active() });
}

export async function listAlertEvents(req: Request, res: Response): Promise<void> {
  const params = parseQuery(eventQuery, req);
  const events = await alertRuleService.events({
    ...(params.service === undefined ? {} : { serviceSlug: params.service }),
    ...(params.state === undefined ? {} : { state: params.state }),
    ...(params.since === undefined ? {} : { since: params.since }),
    ...(params.limit === undefined ? {} : { limit: params.limit }),
  });

  res.json({ data: events });
}

export async function evaluateNow(_req: Request, res: Response): Promise<void> {
  res.json({ data: await alertEngine.evaluate() });
}
