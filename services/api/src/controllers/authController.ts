import type { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { parseBody } from '../lib/validation.js';
import { requireUser } from '../middleware/authenticate.js';

const loginBody = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function login(req: Request, res: Response): Promise<void> {
  const credentials = parseBody(loginBody, req);
  const result = await authService.login(credentials.email, credentials.password);

  res.json({
    data: {
      token: result.token,
      expiresIn: result.expiresIn,
      expiresAt: result.expiresAt,
      user: result.user,
    },
  });
}

export async function currentUser(req: Request, res: Response): Promise<void> {
  const { id } = requireUser(req);
  res.json({ data: await authService.profile(id) });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.status(204).send();
}
