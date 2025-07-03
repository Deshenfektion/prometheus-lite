import { Router } from 'express';
import { ingestRoutes } from './ingestRoutes.js';
import { metricRoutes } from './metricRoutes.js';
import { serviceRoutes } from './serviceRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/services', serviceRoutes);
apiRoutes.use('/metrics', metricRoutes);
apiRoutes.use('/ingest', ingestRoutes);
