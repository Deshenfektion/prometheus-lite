import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { currentUser, login, logout } from '../controllers/authController.js';

export const authRoutes = Router();

authRoutes.post('/login', asyncHandler(login));
authRoutes.post('/logout', authenticate, logout);
authRoutes.get('/me', authenticate, asyncHandler(currentUser));
