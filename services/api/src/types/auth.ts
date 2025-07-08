export type Role = 'USER' | 'ADMIN';

export interface UserRecord {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserWithSecret extends UserRecord {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role?: Role;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: Role;
}
