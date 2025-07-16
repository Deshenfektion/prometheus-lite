import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { closePool } from './db/pool.js';
import { logger } from './lib/logger.js';

const executed = await runMigrations();
if (executed.length > 0) {
  logger.info({ executed }, 'schema updated');
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'api listening');
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  server.close(() => {
    closePool()
      .catch((error: unknown) => {
        logger.error({ err: error }, 'failed to close the connection pool');
      })
      .finally(() => {
        process.exit(0);
      });
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
