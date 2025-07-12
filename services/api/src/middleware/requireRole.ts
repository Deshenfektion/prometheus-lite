import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import type { Role } from '../types/auth.js';

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (req.user === undefined) {
      next(new UnauthorizedError());
      return;
    }

    if (!allowed.includes(req.user.role)) {
      next(new ForbiddenError(`This action requires one of: ${allowed.join(', ')}`));
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
