import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  console.error('💥 [Global Error Handler]:', err);

  // 1. Zod validation error
  if (err instanceof ZodError) {
    const errorDetails = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 'VALIDATION_ERROR', 'Invalid request body or parameters', 422, errorDetails);
    return;
  }

  // 2. Prisma Database Errors
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    if (err.code === 'P2002') {
      sendError(res, 'CONFLICT', 'A record with this unique identifier already exists', 409);
      return;
    }
    sendError(res, 'DATABASE_ERROR', 'A database operation failed', 500, { code: err.code });
    return;
  }

  // 3. Known application errors
  if (err.statusCode && err.code) {
    sendError(res, err.code, err.message, err.statusCode);
    return;
  }

  // 4. Default 500 Internal Server Error
  const message = err.message || 'An unexpected internal server error occurred';
  sendError(res, 'INTERNAL_SERVER_ERROR', message, 500);
}
