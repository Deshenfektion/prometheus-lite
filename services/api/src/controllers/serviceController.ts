import type { Request, Response } from 'express';
import { z } from 'zod';
import { serviceRegistry } from '../services/serviceRegistry.js';
import { parseBody, parseParams, parseQuery } from '../lib/validation.js';

const slugParams = z.object({
  slug: z.string().min(2).max(63),
});

const listQuery = z.object({
  environment: z.string().min(1).max(32).optional(),
  enabled: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

const createBody = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  displayName: z.string().min(1).max(120),
  baseUrl: z.string().url(),
  healthPath: z.string().startsWith('/').max(200).optional(),
  environment: z.string().min(1).max(32).optional(),
  pollIntervalSeconds: z.number().int().min(1).max(3600).optional(),
  timeoutMs: z.number().int().min(100).max(60_000).optional(),
  enabled: z.boolean().optional(),
});

const updateBody = createBody.omit({ slug: true }).partial();

export async function listServices(req: Request, res: Response): Promise<void> {
  const filter = parseQuery(listQuery, req);
  const services = await serviceRegistry.list(filter);
  res.json({ data: services });
}

export async function getService(req: Request, res: Response): Promise<void> {
  const { slug } = parseParams(slugParams, req);
  const service = await serviceRegistry.getBySlug(slug);
  res.json({ data: service });
}

export async function createService(req: Request, res: Response): Promise<void> {
  const input = parseBody(createBody, req);
  const service = await serviceRegistry.create(input);
  res.status(201).json({ data: service });
}

export async function updateService(req: Request, res: Response): Promise<void> {
  const { slug } = parseParams(slugParams, req);
  const patch = parseBody(updateBody, req);
  const service = await serviceRegistry.update(slug, patch);
  res.json({ data: service });
}

export async function deleteService(req: Request, res: Response): Promise<void> {
  const { slug } = parseParams(slugParams, req);
  await serviceRegistry.remove(slug);
  res.status(204).send();
}
