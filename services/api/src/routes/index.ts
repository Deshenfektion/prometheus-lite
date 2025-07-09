import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { ingestRoutes } from './ingestRoutes.js';
import { metricRoutes } from './metricRoutes.js';
import { serviceRoutes } from './serviceRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/services', serviceRoutes);
apiRoutes.use('/metrics', metricRoutes);
apiRoutes.use('/ingest', ingestRoutes);
