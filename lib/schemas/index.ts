// lib/schemas/index.ts
// Zod schemas for API request/response validation

import { z } from 'zod';

/**
 * Common schemas
 */

// Solana public key validation
export const solanaPublicKeySchema = z
  .string()
  .min(32, 'Invalid Solana public key')
  .max(44, 'Invalid Solana public key')
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana public key format');

// Email schema
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim();

// UUID schema
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format');

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Authentication schemas
 */

export const emailLoginSchema = z.object({
  email: emailSchema,
  action: z.enum(['signin', 'signup']).optional(),
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d{6}$/, 'Verification code must be numeric'),
});

export const walletSignatureSchema = z.object({
  walletAddress: solanaPublicKeySchema,
  signature: z.string().min(1, 'Signature required'),
  message: z.string().min(1, 'Message required'),
});

/**
 * Track/Content schemas
 */

export const trackPlaySchema = z.object({
  trackId: uuidSchema,
  duration: z.number().int().min(0).max(600, 'Duration cannot exceed 10 minutes'),
});

export const trackLikeSchema = z.object({
  trackId: uuidSchema,
});

export const trackUploadSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  genre: z.string().max(50).optional(),
  audioUrl: z.string().url('Invalid audio URL'),
  coverUrl: z.string().url('Invalid cover image URL').optional(),
  duration: z.number().int().min(1),
  priceSOL: z.number().min(0).optional(),
  priceToken: z.number().int().min(0).optional(),
  gateType: z.enum(['none', 'token', 'nft']).default('none'),
  gateTokenMint: solanaPublicKeySchema.optional(),
  gateTokenAmount: z.number().int().min(1).optional(),
  gateCollectionAddress: solanaPublicKeySchema.optional(),
  isExplicit: z.boolean().default(false),
});

export const trackUpdateSchema = trackUploadSchema.partial().extend({
  id: uuidSchema,
});

/**
 * Purchase schemas
 */

export const purchaseInitiateSchema = z.object({
  walletAddress: solanaPublicKeySchema,
  contentId: uuidSchema,
  contentType: z.enum(['track', 'video', 'album']),
  paymentMethod: z.enum(['sol', 'token']),
  referrerWallet: solanaPublicKeySchema.optional(),
});

export const purchaseConfirmSchema = z.object({
  purchaseId: z.string().min(1),
  signature: z.string().min(1, 'Transaction signature required'),
  walletAddress: solanaPublicKeySchema,
  contentId: uuidSchema,
  expectedAmount: z.number().positive('Amount must be positive').optional(),
  paymentMethod: z.enum(['sol', 'token']),
});

/**
 * Social schemas
 */

export const followSchema = z.object({
  artistId: uuidSchema,
});

export const commentSchema = z.object({
  trackId: uuidSchema,
  content: z.string().min(1).max(1000, 'Comment cannot exceed 1000 characters'),
  parentId: uuidSchema.optional(),
});

export const repostSchema = z.object({
  trackId: uuidSchema,
  comment: z.string().max(280, 'Repost comment cannot exceed 280 characters').optional(),
});

/**
 * User/Profile schemas
 */

export const profileUpdateSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  bannerUrl: z.string().url('Invalid banner URL').optional(),
  website: z.string().url('Invalid website URL').optional(),
  twitter: z.string().max(50).optional(),
  instagram: z.string().max(50).optional(),
  discord: z.string().max(50).optional(),
});

/**
 * Artist schemas
 */

export const artistCreateSchema = z.object({
  stageName: z.string().min(1).max(100),
  bio: z.string().max(1000).optional(),
  genre: z.string().max(50).optional(),
});

export const releaseCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  releaseType: z.enum(['single', 'ep', 'album', 'mixtape']),
  releaseDate: z.coerce.date(),
  coverUrl: z.string().url('Invalid cover image URL'),
  trackIds: z.array(uuidSchema).min(1, 'At least one track required'),
  priceSOL: z.number().min(0).optional(),
  priceToken: z.number().int().min(0).optional(),
});

/**
 * Subscription schemas
 */

export const subscriptionCreateSchema = z.object({
  artistId: uuidSchema,
  tier: z.enum(['basic', 'premium', 'exclusive']),
  paymentMethod: z.enum(['sol', 'token']),
});

export const subscriptionCancelSchema = z.object({
  subscriptionId: uuidSchema,
});

/**
 * Tip/Donation schemas
 */

export const tipSchema = z.object({
  recipientId: uuidSchema,
  recipientType: z.enum(['artist', 'track']),
  amount: z.number().positive('Tip amount must be positive'),
  currency: z.enum(['sol', 'token']),
  message: z.string().max(280).optional(),
});

/**
 * Analytics schemas
 */

export const analyticsQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  trackId: uuidSchema.optional(),
});

/**
 * Helper function to validate request body
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

/**
 * Type-safe query parameter parser
 */
export function parseQueryParams<T extends z.ZodTypeAny>(
  schema: T,
  params: Record<string, string | string[] | undefined>
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  // Convert query params to flat object
  const flatParams = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );

  return validateRequest(schema, flatParams);
}
