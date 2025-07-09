import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';
import type { AuthenticatedUser, Role } from '../types/auth.js';

interface AccessTokenClaims extends jwt.JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface IssuedToken {
  token: string;
  expiresIn: number;
  expiresAt: string;
}

export function signAccessToken(user: AuthenticatedUser): IssuedToken {
  const expiresIn = env.JWT_EXPIRES_IN;
  const token = jwt.sign({ email: user.email, role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    issuer: env.JWT_ISSUER,
    expiresIn,
  });

  return {
    token,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

function isAccessTokenClaims(payload: unknown): payload is AccessTokenClaims {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate['sub'] === 'string' &&
    typeof candidate['email'] === 'string' &&
    (candidate['role'] === 'USER' || candidate['role'] === 'ADMIN')
  );
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  let payload: unknown;

  try {
    payload = jwt.verify(token, env.JWT_SECRET, { issuer: env.JWT_ISSUER });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired');
    }
    throw new UnauthorizedError('Access token is invalid');
  }

  if (!isAccessTokenClaims(payload)) {
    throw new UnauthorizedError('Access token is malformed');
  }

  const id = Number.parseInt(payload.sub, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new UnauthorizedError('Access token is malformed');
  }

  return { id, email: payload.email, role: payload.role };
}

export function extractBearerToken(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || value === undefined || value.length === 0) {
    return null;
  }
  return value;
}
