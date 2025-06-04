import express, { type Express, type Request, type Response } from 'express';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  return app;
}
