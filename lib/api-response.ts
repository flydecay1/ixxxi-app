// lib/api-response.ts
// Standardized API response formats

import { NextResponse } from 'next/server';

/**
 * Standard success response format
 */
interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

/**
 * Paginated response format
 */
interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  meta?: Record<string, unknown>
): NextResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

/**
 * Create a created (201) response
 */
export function createdResponse<T>(
  data: T,
  meta?: Record<string, unknown>
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status: 201 }
  );
}

/**
 * Create a no content (204) response
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Create an accepted (202) response for async operations
 */
export function acceptedResponse<T>(
  data: T,
  meta?: Record<string, unknown>
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status: 202 }
  );
}

/**
 * Helper to add cache headers to a response
 */
export function withCache(
  response: NextResponse,
  maxAge: number,
  options?: {
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    staleIfError?: number;
    public?: boolean;
  }
): NextResponse {
  const {
    sMaxAge = maxAge,
    staleWhileRevalidate,
    staleIfError,
    public: isPublic = false,
  } = options || {};

  const directives = [
    isPublic ? 'public' : 'private',
    `max-age=${maxAge}`,
    `s-maxage=${sMaxAge}`,
  ];

  if (staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  if (staleIfError) {
    directives.push(`stale-if-error=${staleIfError}`);
  }

  response.headers.set('Cache-Control', directives.join(', '));

  return response;
}

/**
 * Helper to add CORS headers to a response
 */
export function withCORS(
  response: NextResponse,
  options?: {
    origin?: string;
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
  }
): NextResponse {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
  } = options || {};

  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', methods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', headers.join(', '));

  if (credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

/**
 * Helper to add security headers to a response
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

/**
 * Helper to add rate limit headers to a response
 */
export function withRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  reset: number
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(reset));

  return response;
}

/**
 * Type guards for response validation
 */
export function isSuccessResponse(response: unknown): response is SuccessResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true &&
    'data' in response
  );
}

export function isPaginatedResponse(response: unknown): response is PaginatedResponse {
  return (
    isSuccessResponse(response) &&
    'pagination' in response &&
    typeof response.pagination === 'object'
  );
}
