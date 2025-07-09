import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { login, logout } from '../controllers/authController.js';

export const authRoutes = Router();

authRoutes.post('/login', asyncHandler(login));
authRoutes.post('/logout', asyncHandler(logout));
