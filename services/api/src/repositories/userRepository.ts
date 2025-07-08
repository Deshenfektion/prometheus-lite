import type { Queryable } from '../db/queryable.js';
import { pool } from '../db/pool.js';
import type { Role, UserRecord, UserWithSecret } from '../types/auth.js';

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
  active: boolean;
  last_login_at: Date | null;
  created_at: Date;
}

const COLUMNS = `
  id, email, password_hash, display_name, role, active, last_login_at, created_at
`;

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
    lastLoginAt: row.last_login_at === null ? null : row.last_login_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

function toRecordWithSecret(row: UserRow): UserWithSecret {
  return { ...toRecord(row), passwordHash: row.password_hash };
}

export class UserRepository {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async findByEmail(email: string): Promise<UserWithSecret | null> {
    const result = await this.db.query<UserRow>(
      `SELECT ${COLUMNS} FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    const row = result.rows[0];
    return row === undefined ? null : toRecordWithSecret(row);
  }

  async findById(id: number): Promise<UserRecord | null> {
    const result = await this.db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    const row = result.rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async list(): Promise<UserRecord[]> {
    const result = await this.db.query<UserRow>(
      `SELECT ${COLUMNS} FROM users ORDER BY created_at ASC`,
    );
    return result.rows.map(toRecord);
  }

  async create(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    role: Role;
  }): Promise<UserRecord> {
    const result = await this.db.query<UserRow>(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [input.email, input.passwordHash, input.displayName, input.role],
    );
    return toRecord(result.rows[0] as UserRow);
  }

  async markLogin(id: number): Promise<void> {
    await this.db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
  }
}

export const userRepository = new UserRepository();
