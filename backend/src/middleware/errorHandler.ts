import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'objection';
import { logger } from '../utils/logger';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: any;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common errors
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', details?: any) {
    super(message, 400, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, true);
  }
}

export class ValidationErrorClass extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, 422, true, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, true, { retryAfter });
  }
}

// Error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Error occurred:', {
    error: {
      message: err.message,
      stack: err.stack,
      ...((err as any).details && { details: (err as any).details }),
    },
    request: {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      body: req.body,
      headers: req.headers,
      ip: req.ip,
      userId: (req as any).user?.id,
    },
  });

  // Handle Objection.js validation errors
  if (err instanceof ValidationError) {
    const error = new ValidationErrorClass('Validation failed', err.data);
    res.status(error.statusCode).json({
      error: 'Validation Error',
      message: error.message,
      details: error.details,
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    const error = new UnauthorizedError('Invalid token');
    res.status(error.statusCode).json({
      error: 'Unauthorized',
      message: error.message,
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    const error = new UnauthorizedError('Token expired');
    res.status(error.statusCode).json({
      error: 'Unauthorized',
      message: error.message,
    });
    return;
  }

  // Handle custom app errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  // Handle multer errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    let statusCode = 400;

    switch ((err as any).code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large';
        statusCode = 413;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field';
        break;
    }

    res.status(statusCode).json({
      error: 'Upload Error',
      message,
    });
    return;
  }

  // Default error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = (err as any).statusCode || 500;
  
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : 'Error',
    message: isDevelopment ? err.message : 'An unexpected error occurred',
    ...(isDevelopment && { stack: err.stack }),
  });
};

// Async handler wrapper
export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
