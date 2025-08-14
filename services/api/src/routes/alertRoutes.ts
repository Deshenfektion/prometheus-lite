import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireRole.js';
import {
  createAlertRule,
  deleteAlertRule,
  evaluateNow,
  listActiveAlerts,
  listAlertEvents,
  listAlertRules,
  updateAlertRule,
} from '../controllers/alertController.js';

export const alertRoutes = Router();

alertRoutes.get('/', asyncHandler(listActiveAlerts));
alertRoutes.get('/events', asyncHandler(listAlertEvents));
alertRoutes.get('/rules', asyncHandler(listAlertRules));

alertRoutes.post('/rules', requireAdmin, asyncHandler(createAlertRule));
alertRoutes.patch('/rules/:id', requireAdmin, asyncHandler(updateAlertRule));
alertRoutes.delete('/rules/:id', requireAdmin, asyncHandler(deleteAlertRule));
alertRoutes.post('/evaluate', requireAdmin, asyncHandler(evaluateNow));
