import { Router } from 'express';
import { serviceRoutes } from './serviceRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/services', serviceRoutes);
