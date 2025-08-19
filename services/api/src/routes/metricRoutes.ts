import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getLatestMetrics,
  getMetricAnomalies,
  getMetricHistory,
  listMetricDefinitions,
} from '../controllers/metricsController.js';

export const metricRoutes = Router();

metricRoutes.get('/', asyncHandler(listMetricDefinitions));
metricRoutes.get('/latest', asyncHandler(getLatestMetrics));
metricRoutes.get('/history', asyncHandler(getMetricHistory));
metricRoutes.get('/anomalies', asyncHandler(getMetricAnomalies));
