import { UserRepository, userRepository } from '../repositories/userRepository.js';
import { signAccessToken } from '../lib/jwt.js';
import { verifyPassword } from '../lib/password.js';
import { UnauthorizedError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { IssuedToken } from '../lib/jwt.js';
import type { UserRecord } from '../types/auth.js';

const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.uMSKtiHi/Fzu3rWPTUqEyRDkKNCwLxG';

export interface LoginResult extends IssuedToken {
  user: UserRecord;
}

export class AuthService {
  private readonly users: UserRepository;

  constructor(users: UserRepository = userRepository) {
    this.users = users;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByEmail(email);
    const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (user === null || !matches || !user.active) {
      logger.warn({ email }, 'failed login attempt');
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.users.markLogin(user.id);

    const issued = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const { passwordHash: _passwordHash, ...safe } = user;

    logger.info({ userId: user.id, role: user.role }, 'login succeeded');
    return { ...issued, user: safe };
  }

  async profile(id: number): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (user === null || !user.active) {
      throw new UnauthorizedError('Account is no longer active');
    }
    return user;
  }
}

export const authService = new AuthService();
