import { afterAll } from 'vitest';
import { disconnect } from './helpers/database.js';

afterAll(async () => {
  await disconnect();
});
