// lib/drm/contentProtection.ts
// Content protection utilities - prevents unauthorized downloading/ripping

import crypto from 'crypto';
import { cache } from '../cache';

// Validate signing secret on startup
function getSigningSecret(): string {
  const secret = process.env.CONTENT_SIGNING_SECRET;

  if (!secret || secret === 'dev-secret-change-in-prod' || secret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CONTENT_SIGNING_SECRET must be set to a secure value (min 32 chars) in production'
      );
    }
    console.warn('[SECURITY] Using weak signing secret in development. Set CONTENT_SIGNING_SECRET in production.');
    return 'dev-secret-for-development-only-do-not-use-in-prod';
  }

  return secret;
}

const SIGNING_SECRET = getSigningSecret();
const URL_EXPIRY_SECONDS = 30; // URLs expire very quickly

interface SignedUrlParams {
  contentId: string;
  userId: string;
  contentType: 'audio' | 'video';
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Generate a short-lived signed URL for content access
 * These URLs expire quickly and are tied to a specific user
 */
export function generateSignedUrl(params: SignedUrlParams): string {
  const { contentId, userId, contentType, quality = 'high' } = params;

  const expiresAt = Math.floor(Date.now() / 1000) + URL_EXPIRY_SECONDS;
  const nonce = crypto.randomBytes(8).toString('hex');

  // Create signature payload
  const payload = `${contentId}:${userId}:${contentType}:${quality}:${expiresAt}:${nonce}`;
  const signature = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(payload)
    .digest('hex');

  // Encode params
  const token = Buffer.from(JSON.stringify({
    c: contentId,    // content ID
    u: userId,       // user ID (for watermarking)
    t: contentType,  // type
    q: quality,      // quality
    e: expiresAt,    // expiry
    n: nonce,        // nonce (prevent replay)
    s: signature,    // signature
  })).toString('base64url');

  return `/api/stream/${token}`;
}

/**
 * Verify a signed URL token
 */
export function verifySignedUrl(token: string): {
  valid: boolean;
  params?: SignedUrlParams & { expiresAt: number };
  error?: string;
} {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    const { c: contentId, u: userId, t: contentType, q: quality, e: expiresAt, n: nonce, s: signature } = decoded;

    // Check expiry (expiresAt is in seconds, Date.now() is in milliseconds)
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (nowInSeconds > expiresAt) {
      return { valid: false, error: 'URL expired' };
    }

    // Verify signature
    const payload = `${contentId}:${userId}:${contentType}:${quality}:${expiresAt}:${nonce}`;
    const expectedSignature = crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    return {
      valid: true,
      params: { contentId, userId, contentType, quality, expiresAt },
    };
  } catch {
    return { valid: false, error: 'Invalid token' };
  }
}

/**
 * Generate a unique watermark ID to embed in audio
 * This allows tracing leaked content back to the source
 */
export function generateWatermark(userId: string, trackId: string): string {
  const timestamp = Date.now();
  const data = `${userId}:${trackId}:${timestamp}`;

  // Create a short, unique watermark code
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash.slice(0, 16); // 16-char watermark
}

/**
 * Rate limiting for stream requests using Redis
 * Prevents bulk downloading attempts
 */
export async function checkStreamRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowSeconds = 60; // 1 minute window
  const maxRequests = 30; // Max 30 stream requests per minute (enough for normal use)
  const key = `stream_rate:${userId}`;

  try {
    // Use Redis for distributed rate limiting
    const count = await cache.incr(key, windowSeconds);

    if (count > maxRequests) {
      return {
        allowed: false,
        retryAfter: windowSeconds
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open if Redis is down (but log it)
    return { allowed: true };
  }
}

/**
 * Detect suspicious behavior patterns using Redis
 */
interface StreamEvent {
  userId: string;
  trackId: string;
  timestamp: number;
  duration: number; // How long they listened
}

export async function detectSuspiciousBehavior(userId: string, trackId: string, duration: number): Promise<{
  suspicious: boolean;
  reason?: string;
}> {
  const key = `stream_events:${userId}`;
  const now = Date.now();

  try {
    // Get recent events from Redis
    const eventsData = await cache.get<StreamEvent[]>(key) || [];

    // Add current event
    const newEvent: StreamEvent = { userId, trackId, timestamp: now, duration };
    eventsData.push(newEvent);

    // Keep only last 5 minutes of events
    const recentEvents = eventsData.filter(e => now - e.timestamp < 300000);

    // Store back to Redis with 5 min TTL
    await cache.set(key, recentEvents, 300);

    // Check for suspicious patterns

    // 1. Too many unique tracks in short time (bulk scraping)
    const uniqueTracks = new Set(recentEvents.map(e => e.trackId));
    if (uniqueTracks.size > 20) {
      return { suspicious: true, reason: 'Too many unique tracks accessed' };
    }

    // 2. Very short listen durations (skipping through to download)
    const shortListens = recentEvents.filter(e => e.duration < 5);
    if (shortListens.length > 10) {
      return { suspicious: true, reason: 'Abnormal listening pattern' };
    }

    // 3. Accessing same track too frequently (trying to piece together)
    const trackCounts = recentEvents.reduce((acc, e) => {
      acc[e.trackId] = (acc[e.trackId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const count of Object.values(trackCounts)) {
      if (count > 10) {
        return { suspicious: true, reason: 'Repeated access pattern detected' };
      }
    }

    return { suspicious: false };
  } catch (error) {
    console.error('Suspicious behavior check error:', error);
    return { suspicious: false }; // Fail open if Redis is down
  }
}

/**
 * Generate HLS encryption key for a content piece
 */
export function generateHLSKey(contentId: string, userId: string): {
  key: Buffer;
  iv: Buffer;
  keyUri: string;
} {
  // Derive key from content + user (so each user gets unique encrypted stream)
  const keyMaterial = `${contentId}:${userId}:${SIGNING_SECRET}`;
  const key = crypto.createHash('sha256').update(keyMaterial).digest().slice(0, 16); // AES-128 key

  // Generate IV from content ID
  const iv = crypto.createHash('md5').update(contentId).digest();

  // Key URI for HLS manifest
  const keyToken = Buffer.from(JSON.stringify({
    c: contentId,
    u: userId,
  })).toString('base64url');

  return {
    key,
    iv,
    keyUri: `/api/stream/key/${keyToken}`,
  };
}
