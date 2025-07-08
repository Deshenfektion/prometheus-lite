import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  if (plaintext.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return bcrypt.hash(plaintext, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
