import { env } from '../../config/env.js';
import { signAccessToken } from '../../lib/jwt.js';
import { hashPassword } from '../../lib/password.js';
import { userRepository } from '../../repositories/userRepository.js';
import type { Role } from '../../types/auth.js';

export const TEST_PASSWORD = 'test-password-1234';
export const COLLECTOR_TOKEN = env.INGEST_TOKEN;

export interface TestUser {
  id: number;
  email: string;
  password: string;
  role: Role;
  token: string;
}

export async function createTestUser(role: Role = 'ADMIN', email?: string): Promise<TestUser> {
  const address = email ?? `${role.toLowerCase()}@prometheus-lite.test`;
  const user = await userRepository.create({
    email: address,
    passwordHash: await hashPassword(TEST_PASSWORD),
    displayName: `Test ${role}`,
    role,
  });

  const { token } = signAccessToken({ id: user.id, email: user.email, role });
  return { id: user.id, email: user.email, password: TEST_PASSWORD, role, token };
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}
