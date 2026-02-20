import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware
 */

export interface APIError {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

/**
 * Custom Error class for API errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handler middleware - must be last middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] as string || 'unknown';

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let error = 'INTERNAL_ERROR';
  const details: Record<string, any> = {};

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    error = mapStatusCodeToError(err.statusCode);
  }
  // Handle validation errors
  else if (err.message?.includes('validation') || err.message?.includes('Invalid')) {
    statusCode = 400;
    message = err.message;
    error = 'VALIDATION_ERROR';
  }
  // Handle database errors
  else if (err.message?.includes('ECONNREFUSED') || err.message?.includes('Connection refused')) {
    statusCode = 503;
    message = 'Database connection failed';
    error = 'DATABASE_ERROR';
  }
  // Handle not found errors
  else if (err.message?.includes('not found') || err.message?.includes('Not found')) {
    statusCode = 404;
    message = err.message;
    error = 'NOT_FOUND';
  }
  // Handle timeout errors
  else if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
    statusCode = 504;
    message = 'Request timeout';
    error = 'TIMEOUT_ERROR';
  }

  // Log error
  console.error({
    timestamp,
    requestId,
    statusCode,
    error,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Send error response
  return res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { details: { stack: err.stack } })
  });
};

/**
 * Async route wrapper to catch errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Map status codes to error types
 */
function mapStatusCodeToError(statusCode: number): string {
  const errorMap: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT'
  };
  return errorMap[statusCode] || 'UNKNOWN_ERROR';
}

/**
 * 404 handler - should be last route
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString()
  });
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] as string || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  next();
};
