// lib/env.ts
// Environment variable validation - validates on startup

import { z } from 'zod';

/**
 * Environment variable schema
 * Define all required and optional environment variables here
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Redis (required in production)
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis connection string').optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().regex(/^\d+$/, 'REDIS_PORT must be a number').optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Solana
  NEXT_PUBLIC_SOLANA_RPC_URL: z
    .string()
    .url('NEXT_PUBLIC_SOLANA_RPC_URL must be a valid URL')
    .default('https://api.devnet.solana.com'),

  NEXT_PUBLIC_SOLANA_RPC: z
    .string()
    .url('NEXT_PUBLIC_SOLANA_RPC must be a valid URL')
    .optional(),

  PLATFORM_WALLET: z
    .string()
    .min(32, 'PLATFORM_WALLET must be a valid Solana public key')
    .optional(),

  IXXXI_TOKEN_MINT: z
    .string()
    .min(32, 'IXXXI_TOKEN_MINT must be a valid Solana public key')
    .optional(),

  // Security - Required in production
  WALLET_ENCRYPTION_KEY: z
    .string()
    .min(32, 'WALLET_ENCRYPTION_KEY must be at least 32 characters')
    .refine(
      (val) => val !== 'dev-key-change-in-prod',
      'WALLET_ENCRYPTION_KEY cannot use default value in production'
    ),

  CONTENT_SIGNING_SECRET: z
    .string()
    .min(32, 'CONTENT_SIGNING_SECRET must be at least 32 characters')
    .refine(
      (val) => val !== 'dev-secret-change-in-prod',
      'CONTENT_SIGNING_SECRET cannot use default value in production'
    ),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .optional(),

  // Email service (required for authentication)
  RESEND_API_KEY: z
    .string()
    .min(1, 'RESEND_API_KEY is required for email authentication')
    .optional(),

  EMAIL_FROM: z
    .string()
    .email('EMAIL_FROM must be a valid email address')
    .default('noreply@ixxxi.app'),

  // Storage
  NEXT_PUBLIC_IPFS_GATEWAY: z
    .string()
    .url('NEXT_PUBLIC_IPFS_GATEWAY must be a valid URL')
    .optional(),

  PINATA_API_KEY: z.string().optional(),
  PINATA_SECRET_KEY: z.string().optional(),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL must be a valid URL')
    .optional(),

  // Optional features
  ENABLE_ANALYTICS: z
    .string()
    .transform((val) => val === 'true')
    .optional(),

  ENABLE_SUBSCRIPTIONS: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// Type-safe environment variables
export type Env = z.infer<typeof envSchema>;

// Cached validated environment
let validatedEnv: Env | null = null;

/**
 * Validate environment variables
 * Call this early in your application lifecycle (e.g., in instrumentation.ts or app layout)
 */
export function validateEnv(): Env {
  // Return cached result if already validated
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    // Parse and validate environment variables
    const parsed = envSchema.parse(process.env);
    validatedEnv = parsed;

    // Additional production-specific checks
    if (parsed.NODE_ENV === 'production') {
      const prodRequiredVars = [
        'DATABASE_URL',
        'WALLET_ENCRYPTION_KEY',
        'CONTENT_SIGNING_SECRET',
      ];

      const missing = prodRequiredVars.filter((key) => !process.env[key]);

      if (missing.length > 0) {
        throw new Error(
          `Missing required environment variables for production: ${missing.join(', ')}`
        );
      }

      // Warn about Redis in production
      if (!parsed.REDIS_URL && !parsed.REDIS_HOST) {
        console.warn(
          '[WARN] Redis not configured. Some features (rate limiting, caching) will be degraded.'
        );
      }

      // Warn about email service
      if (!parsed.RESEND_API_KEY) {
        console.warn(
          '[WARN] RESEND_API_KEY not set. Email authentication will not work.'
        );
      }
    }

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');

      console.error('❌ Environment validation failed:\n' + errorMessage);

      throw new Error(
        'Invalid environment configuration. Please check your .env file.\n' + errorMessage
      );
    }

    throw error;
  }
}

/**
 * Get validated environment variables
 * This will validate on first call, then cache the result
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

/**
 * Helper to check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof Pick<Env, 'ENABLE_ANALYTICS' | 'ENABLE_SUBSCRIPTIONS'>): boolean {
  const env = getEnv();
  return !!env[feature];
}

/**
 * Development-only: Reset cached environment (useful for testing)
 */
export function resetEnvCache(): void {
  if (process.env.NODE_ENV !== 'production') {
    validatedEnv = null;
  }
}

// Validate on module load in production
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}
