import type { Request, Response } from 'express';
import { dashboardService } from '../services/dashboardService.js';

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  const summary = await dashboardService.summary();
  res.json({ data: summary });
}
