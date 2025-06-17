import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ingestSnapshots } from '../controllers/ingestController.js';

export const ingestRoutes = Router();

ingestRoutes.post('/snapshots', asyncHandler(ingestSnapshots));
