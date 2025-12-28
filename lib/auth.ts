// lib/auth.ts
// Shared authentication utilities

import crypto from 'crypto';

// In production, use Redis for code storage
// This is a simple in-memory store for development
const verificationCodes = new Map<string, { 
  code: string; 
  expiresAt: number; 
  action: string;
}>();

// Generate random 6-digit code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash email for privacy in logs
export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

// Store a verification code
export function storeVerificationCode(email: string, code: string, action: string): void {
  verificationCodes.set(email, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    action,
  });
}

// Get a verification code
export function getVerificationCode(email: string): { code: string; expiresAt: number; action: string } | undefined {
  return verificationCodes.get(email);
}

// Delete a verification code
export function deleteVerificationCode(email: string): void {
  verificationCodes.delete(email);
}

// Clean up expired codes periodically
export function cleanupExpiredCodes(): void {
  const now = Date.now();
  for (const [email, data] of verificationCodes.entries()) {
    if (now > data.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}
