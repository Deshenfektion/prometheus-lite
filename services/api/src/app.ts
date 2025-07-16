import express, { type Express, type Request, type Response } from 'express';
import { query } from './db/pool.js';
import { apiRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { asyncHandler } from './middleware/asyncHandler.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get(
    '/health',
    asyncHandler(async (_req: Request, res: Response) => {
      let database = 'ok';
      try {
        await query('SELECT 1');
      } catch {
        database = 'unavailable';
      }

      const status = database === 'ok' ? 200 : 503;
      res.status(status).json({
        status: status === 200 ? 'ok' : 'degraded',
        database,
        uptimeSeconds: Math.round(process.uptime()),
      });
    }),
  );

  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
