// lib/middleware/auth.ts
// Authentication middleware for API routes

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export interface AuthContext {
  userId: string;
  walletAddress: string;
  email: string;
  role: string;
  tier: string;
  isArtist: boolean;
}

export interface AuthenticatedRequest extends NextRequest {
  auth?: AuthContext;
}

/**
 * Extract and validate session from cookies
 */
async function getSessionFromCookies(): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    const sessionCookie = cookieStore.get('session');

    if (!userCookie?.value || !sessionCookie?.value) {
      return null;
    }

    // Parse user data
    const userData = JSON.parse(userCookie.value);

    // Validate session token exists (in production, verify against Redis/database)
    if (!sessionCookie.value || sessionCookie.value.length < 32) {
      return null;
    }

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: userData.id },
      include: { artist: true },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      walletAddress: user.walletAddress,
      email: user.email,
      role: user.role,
      tier: user.tier,
      isArtist: !!user.artist,
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Verify wallet signature to prove ownership
 * This should be used for sensitive operations requiring proof of wallet ownership
 */
export async function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    // In production, use @solana/web3.js to verify the signature
    // const publicKey = new PublicKey(walletAddress);
    // const messageBytes = new TextEncoder().encode(message);
    // const signatureBytes = bs58.decode(signature);
    // return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());

    // For now, return true if all parameters are provided
    // TODO: Implement actual signature verification
    return !!(walletAddress && signature && message);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Middleware: Require authenticated user
 * Use this for routes that require a logged-in user
 */
export async function requireAuth(
  request: NextRequest,
  handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await getSessionFromCookies();

  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }

  // Call the actual route handler with auth context
  return handler(request, auth);
}

/**
 * Middleware: Require wallet ownership verification
 * Use this for sensitive operations like payments, uploads, profile changes
 *
 * Expects request body to include:
 * - walletAddress: The wallet claiming to make the request
 * - signature: Signature of the message
 * - message: The message that was signed (should include timestamp and nonce)
 */
export async function requireWalletOwnership(
  request: NextRequest,
  handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await getSessionFromCookies();

  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { walletAddress, signature, message } = body;

    // Verify the wallet address in request matches the authenticated user
    if (!walletAddress || walletAddress !== auth.walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address mismatch' },
        { status: 403 }
      );
    }

    // Verify the signature proves ownership of the wallet
    // For now, we skip signature verification (marked as TODO)
    // In production, this MUST verify the cryptographic signature
    if (signature && message) {
      const isValid = await verifyWalletSignature(walletAddress, signature, message);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid wallet signature' },
          { status: 403 }
        );
      }
    }

    // Re-parse body for the handler (since we already consumed it)
    const clonedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(body),
    });

    return handler(clonedRequest as NextRequest, auth);
  } catch (error) {
    console.error('Wallet ownership verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify wallet ownership' },
      { status: 400 }
    );
  }
}

/**
 * Middleware: Require artist role
 * Use this for artist-only routes like uploads, withdrawals, analytics
 */
export async function requireArtist(
  request: NextRequest,
  handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await getSessionFromCookies();

  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }

  if (!auth.isArtist) {
    return NextResponse.json(
      { error: 'Artist account required. Please set up your artist profile.' },
      { status: 403 }
    );
  }

  return handler(request, auth);
}

/**
 * Middleware: Require admin role
 * Use this for admin-only routes
 */
export async function requireAdmin(
  request: NextRequest,
  handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await getSessionFromCookies();

  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }

  if (auth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  return handler(request, auth);
}

/**
 * Optional auth - returns auth context if available, null otherwise
 * Use this for routes that work differently when authenticated
 */
export async function optionalAuth(
  request: NextRequest,
  handler: (req: NextRequest, auth: AuthContext | null) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await getSessionFromCookies();
  return handler(request, auth);
}

/**
 * Rate limiting by user (more strict than IP-based)
 * Use this for expensive operations or to prevent abuse
 */
export async function requireAuthWithRateLimit(
  request: NextRequest,
  handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>,
  options: {
    maxRequests: number;
    windowSeconds: number;
    keyPrefix: string;
  }
): Promise<NextResponse> {
  const auth = await getSessionFromCookies();

  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }

  // Check rate limit using Redis
  const { cache } = await import('@/lib/cache');
  const key = `${options.keyPrefix}:${auth.userId}`;

  try {
    const count = await cache.incr(key, options.windowSeconds);

    if (count > options.maxRequests) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: options.windowSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(options.windowSeconds) },
        }
      );
    }

    return handler(request, auth);
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open if Redis is down
    return handler(request, auth);
  }
}
