import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_DEPTH = 8;

export function findUpward(relativePath: string, startDir?: string): string | undefined {
  let current = startDir ?? dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const candidate = join(current, relativePath);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return undefined;
}
