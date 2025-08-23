import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { getDashboard } from '../controllers/dashboardController.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/', asyncHandler(getDashboard));
