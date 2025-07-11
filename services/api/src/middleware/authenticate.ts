import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { extractBearerToken, verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';
import { env } from '../config/env.js';
import type { AuthenticatedUser } from '../types/auth.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (token === null) {
    next(new UnauthorizedError('Missing bearer token'));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

export function requireUser(req: Request): AuthenticatedUser {
  if (req.user === undefined) {
    throw new UnauthorizedError();
  }
  return req.user;
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

export const authenticateCollector: RequestHandler = (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (token === null || !tokensMatch(token, env.INGEST_TOKEN)) {
    next(new UnauthorizedError('Invalid collector token'));
    return;
  }
  next();
};
