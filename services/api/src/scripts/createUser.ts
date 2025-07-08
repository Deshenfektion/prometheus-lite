import { parseArgs } from 'node:util';
import { runMigrations } from '../db/migrate.js';
import { closePool } from '../db/pool.js';
import { hashPassword } from '../lib/password.js';
import { userRepository } from '../repositories/userRepository.js';
import type { Role } from '../types/auth.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'USER' },
  },
});

function usage(): never {
  process.stderr.write(
    'usage: npm run create-user --workspace services/api -- ' +
      '--email <email> --password <password> --name <display name> [--role USER|ADMIN]\n',
  );
  process.exit(1);
}

const email = values.email;
const password = values.password;
const displayName = values.name;
const role = (values.role ?? 'USER').toUpperCase() as Role;

if (email === undefined || password === undefined || displayName === undefined) {
  usage();
}
if (role !== 'USER' && role !== 'ADMIN') {
  usage();
}

await runMigrations();

const existing = await userRepository.findByEmail(email);
if (existing !== null) {
  process.stderr.write(`user ${email} already exists\n`);
  await closePool();
  process.exit(1);
}

const user = await userRepository.create({
  email,
  passwordHash: await hashPassword(password),
  displayName,
  role,
});

process.stdout.write(`created ${user.role} ${user.email} (id ${user.id})\n`);
await closePool();
