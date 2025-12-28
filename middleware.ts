// middleware.ts
// Next.js middleware for security, rate limiting, and request processing

import { NextRequest, NextResponse } from 'next/server';

// Rate limiting storage (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Rate limits by endpoint type
const RATE_LIMITS = {
  default: { requests: 100, windowMs: 60000 },      // 100 req/min
  auth: { requests: 10, windowMs: 60000 },          // 10 req/min for auth
  upload: { requests: 5, windowMs: 60000 },         // 5 req/min for uploads
  api: { requests: 60, windowMs: 60000 },           // 60 req/min for API calls
  stream: { requests: 200, windowMs: 60000 },       // 200 req/min for streaming
};

// Security headers
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Blocked user agents (bots, scrapers)
const BLOCKED_USER_AGENTS = [
  'Bytespider',
  'GPTBot',
  'ClaudeBot',
  'CCBot',
  'Amazonbot',
  'anthropic-ai',
  'Google-Extended',
  'FacebookExternalHit',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  // Block known bots/scrapers on protected routes
  if (pathname.startsWith('/api/stream') || pathname.startsWith('/api/download')) {
    const isBlocked = BLOCKED_USER_AGENTS.some(ua => 
      userAgent.toLowerCase().includes(ua.toLowerCase())
    );
    if (isBlocked) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // CORS for API routes
  if (pathname.startsWith('/api')) {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': getAllowedOrigin(request),
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Apply rate limiting
    const rateLimitResult = checkRateLimit(ip, pathname);
    if (!rateLimitResult.allowed) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Too many requests', 
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000) 
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      );
    }

    // Continue with request
    const response = NextResponse.next();

    // Add security headers
    for (const [key, value] of Object.entries(securityHeaders)) {
      response.headers.set(key, value);
    }

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', String(rateLimitResult.limit));
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateLimitResult.resetAt));

    return response;
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

function getClientIP(request: NextRequest): string {
  // Try various headers for real IP (behind proxies/CDN)
  return (
    request.headers.get('cf-connecting-ip') ||     // Cloudflare
    request.headers.get('x-real-ip') ||            // Nginx
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.ip ||
    'unknown'
  );
}

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  
  // In production, whitelist specific origins
  const allowedOrigins = [
    'https://ixxxi-app-production.up.railway.app',
    'https://ixxxi.io',
    'https://www.ixxxi.io',
    'http://localhost:3000',
  ];

  if (process.env.NODE_ENV === 'development') {
    return origin || '*';
  }

  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
}

function checkRateLimit(ip: string, pathname: string): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
} {
  // Determine rate limit tier based on path
  let limitConfig = RATE_LIMITS.default;
  
  if (pathname.includes('/auth') || pathname.includes('/login') || pathname.includes('/signup')) {
    limitConfig = RATE_LIMITS.auth;
  } else if (pathname.includes('/upload')) {
    limitConfig = RATE_LIMITS.upload;
  } else if (pathname.includes('/stream')) {
    limitConfig = RATE_LIMITS.stream;
  } else if (pathname.startsWith('/api')) {
    limitConfig = RATE_LIMITS.api;
  }

  const key = `${ip}:${getPathCategory(pathname)}`;
  const now = Date.now();

  let record = rateLimitMap.get(key);

  // Reset if window expired
  if (!record || now > record.resetAt) {
    record = {
      count: 0,
      resetAt: now + limitConfig.windowMs,
    };
  }

  record.count++;
  rateLimitMap.set(key, record);

  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitMap();
  }

  return {
    allowed: record.count <= limitConfig.requests,
    limit: limitConfig.requests,
    remaining: Math.max(0, limitConfig.requests - record.count),
    resetAt: record.resetAt,
  };
}

function getPathCategory(pathname: string): string {
  if (pathname.includes('/auth') || pathname.includes('/login') || pathname.includes('/signup')) {
    return 'auth';
  }
  if (pathname.includes('/upload')) return 'upload';
  if (pathname.includes('/stream')) return 'stream';
  if (pathname.startsWith('/api')) return 'api';
  return 'default';
}

function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

// Only apply middleware to specific paths
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
