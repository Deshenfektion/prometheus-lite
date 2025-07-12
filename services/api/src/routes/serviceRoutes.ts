import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAdmin } from '../middleware/requireRole.js';
import {
  createService,
  deleteService,
  getService,
  listServices,
  updateService,
} from '../controllers/serviceController.js';

export const serviceRoutes = Router();

serviceRoutes.get('/', asyncHandler(listServices));
serviceRoutes.get('/:slug', asyncHandler(getService));

serviceRoutes.post('/', requireAdmin, asyncHandler(createService));
serviceRoutes.patch('/:slug', requireAdmin, asyncHandler(updateService));
serviceRoutes.delete('/:slug', requireAdmin, asyncHandler(deleteService));
