import { Router } from 'express';
import { authenticate, authenticateCollector } from '../middleware/authenticate.js';
import { alertRoutes } from './alertRoutes.js';
import { authRoutes } from './authRoutes.js';
import { dashboardRoutes } from './dashboardRoutes.js';
import { ingestRoutes } from './ingestRoutes.js';
import { metricRoutes } from './metricRoutes.js';
import { serviceRoutes } from './serviceRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/ingest', authenticateCollector, ingestRoutes);
apiRoutes.use('/services', authenticate, serviceRoutes);
apiRoutes.use('/metrics', authenticate, metricRoutes);
apiRoutes.use('/alerts', authenticate, alertRoutes);
apiRoutes.use('/dashboard', authenticate, dashboardRoutes);
