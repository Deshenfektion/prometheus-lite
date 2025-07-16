import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isProduction } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.path}`,
    },
  });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error({ err: error }, 'request failed');
    }
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  logger.error({ err: error }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Internal server error' : String(error),
    },
  });
};
