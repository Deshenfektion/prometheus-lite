import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  createService,
  deleteService,
  getService,
  listServices,
  updateService,
} from '../controllers/serviceController.js';

export const serviceRoutes = Router();

serviceRoutes.get('/', asyncHandler(listServices));
serviceRoutes.post('/', asyncHandler(createService));
serviceRoutes.get('/:slug', asyncHandler(getService));
serviceRoutes.patch('/:slug', asyncHandler(updateService));
serviceRoutes.delete('/:slug', asyncHandler(deleteService));
