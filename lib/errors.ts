// lib/errors.ts
// Structured error handling for API routes

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Error types for different scenarios
 */
export enum ErrorType {
  // Client errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
}

/**
 * Structured API error
 */
export class ApiError extends Error {
  constructor(
    public type: ErrorType,
    public message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

/**
 * Convert error to HTTP response
 */
export function errorToResponse(error: unknown, includeStack = false): NextResponse<ErrorResponse> {
  // Handle ApiError
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          type: error.type,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString(),
        },
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return NextResponse.json(
      {
        error: {
          type: ErrorType.VALIDATION_ERROR,
          message: 'Validation failed',
          details: validationErrors,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: unknown };

    // P2002: Unique constraint violation
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        {
          error: {
            type: ErrorType.CONFLICT,
            message: 'Resource already exists',
            details: prismaError.meta,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 409 }
      );
    }

    // P2025: Record not found
    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        {
          error: {
            type: ErrorType.NOT_FOUND,
            message: 'Resource not found',
            details: prismaError.meta,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    // Other Prisma errors
    return NextResponse.json(
      {
        error: {
          type: ErrorType.DATABASE_ERROR,
          message: 'Database operation failed',
          details: includeStack ? error : undefined,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';

  console.error('Unhandled error:', error);

  return NextResponse.json(
    {
      error: {
        type: ErrorType.INTERNAL_ERROR,
        message,
        details: includeStack && error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      },
    },
    { status: 500 }
  );
}

/**
 * Predefined error creators for common scenarios
 */

export function validationError(message: string, details?: unknown): ApiError {
  return new ApiError(ErrorType.VALIDATION_ERROR, message, 400, details);
}

export function authenticationError(message = 'Authentication required'): ApiError {
  return new ApiError(ErrorType.AUTHENTICATION_REQUIRED, message, 401);
}

export function authorizationError(message = 'You do not have permission to perform this action'): ApiError {
  return new ApiError(ErrorType.AUTHORIZATION_FAILED, message, 403);
}

export function notFoundError(resource = 'Resource'): ApiError {
  return new ApiError(ErrorType.NOT_FOUND, `${resource} not found`, 404);
}

export function conflictError(message: string, details?: unknown): ApiError {
  return new ApiError(ErrorType.CONFLICT, message, 409, details);
}

export function rateLimitError(retryAfter?: number): ApiError {
  return new ApiError(
    ErrorType.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded. Please try again later.',
    429,
    { retryAfter }
  );
}

export function paymentRequiredError(message = 'Payment required to access this content'): ApiError {
  return new ApiError(ErrorType.PAYMENT_REQUIRED, message, 402);
}

export function internalError(message = 'Internal server error'): ApiError {
  return new ApiError(ErrorType.INTERNAL_ERROR, message, 500);
}

export function blockchainError(message: string, details?: unknown): ApiError {
  return new ApiError(ErrorType.BLOCKCHAIN_ERROR, message, 500, details);
}

export function externalServiceError(service: string, details?: unknown): ApiError {
  return new ApiError(
    ErrorType.EXTERNAL_SERVICE_ERROR,
    `External service error: ${service}`,
    503,
    details
  );
}

/**
 * Async error handler wrapper for API routes
 * Automatically catches and converts errors to responses
 */
export function asyncHandler(
  handler: (request: Request, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (request: Request, ...args: unknown[]): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      const includeStack = process.env.NODE_ENV === 'development';
      return errorToResponse(error, includeStack);
    }
  };
}

/**
 * Assert condition or throw error
 */
export function assert(condition: boolean, error: ApiError): asserts condition {
  if (!condition) {
    throw error;
  }
}

/**
 * Assert value is not null/undefined or throw error
 */
export function assertExists<T>(
  value: T | null | undefined,
  error: ApiError
): asserts value is T {
  if (value === null || value === undefined) {
    throw error;
  }
}
