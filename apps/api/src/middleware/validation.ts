import { Request, Response, NextFunction } from 'express';

/**
 * Input validation middleware for common validation patterns
 */

export class ValidationError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate that required fields are present and non-empty
 */
export const validateRequired = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const field of fields) {
      const value = req.body[field] || req.params[field] || req.query[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Missing required field: ${field}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    next();
  };
};

/**
 * Validate UUID format
 */
export const validateUUID = (field: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[field] || req.body[field];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (value && !uuidRegex.test(value)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid UUID format for field: ${field}`,
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

/**
 * Validate string length
 */
export const validateStringLength = (field: string, min: number = 1, max: number = 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field] || req.params[field];
    
    if (value && typeof value === 'string') {
      if (value.length < min || value.length > max) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Field '${field}' must be between ${min} and ${max} characters}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    next();
  };
};

/**
 * Validate request body is JSON
 */
export const validateJSON = (req: Request, res: Response, next: NextFunction) => {
  if (req.is('json') === false && Object.keys(req.body).length > 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Content-Type must be application/json',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema: Record<string, { required?: boolean; type?: string; pattern?: RegExp }>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.query[field];
      
      if (rules.required && !value) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Missing required query parameter: ${field}`,
          timestamp: new Date().toISOString()
        });
      }
      
      if (value && rules.type === 'string' && typeof value !== 'string') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Query parameter '${field}' must be a string`,
          timestamp: new Date().toISOString()
        });
      }
      
      if (value && rules.pattern && !rules.pattern.test(String(value))) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Query parameter '${field}' does not match expected format`,
          timestamp: new Date().toISOString()
        });
      }
    }
    next();
  };
};
