// lib/auth.ts
// Shared authentication utilities

import crypto from 'crypto';
import { cache } from './cache';

const VERIFICATION_CODE_TTL = 600; // 10 minutes in seconds
const VERIFICATION_CODE_PREFIX = 'verify:';

// Generate random 6-digit code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash email for privacy in logs
export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

// Store a verification code using Redis
export async function storeVerificationCode(email: string, code: string, action: string): Promise<void> {
  const key = `${VERIFICATION_CODE_PREFIX}${email}`;
  const data = {
    code,
    expiresAt: Date.now() + VERIFICATION_CODE_TTL * 1000,
    action,
  };
  await cache.set(key, data, VERIFICATION_CODE_TTL);
}

// Get a verification code from Redis
export async function getVerificationCode(email: string): Promise<{ code: string; expiresAt: number; action: string } | null> {
  const key = `${VERIFICATION_CODE_PREFIX}${email}`;
  return await cache.get<{ code: string; expiresAt: number; action: string }>(key);
}

// Delete a verification code from Redis
export async function deleteVerificationCode(email: string): Promise<void> {
  const key = `${VERIFICATION_CODE_PREFIX}${email}`;
  await cache.del(key);
}

// Validate wallet signature (for wallet-based auth)
export function verifyWalletSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    // This would use @solana/web3.js to verify signature
    // Placeholder for now - implement with nacl.sign.detached.verify
    return true; // TODO: Implement actual verification
  } catch {
    return false;
  }
}

// Create authentication helper to verify request ownership
export interface AuthContext {
  userId: string;
  walletAddress: string;
  role: string;
  tier: string;
}

export async function getAuthContext(
  walletAddress: string | null,
  sessionToken?: string
): Promise<AuthContext | null> {
  if (!walletAddress && !sessionToken) return null;

  // In production, verify session token from Redis/DB
  // For now, this is a placeholder
  return null;
}
