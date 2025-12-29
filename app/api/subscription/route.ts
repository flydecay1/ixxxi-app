// app/api/subscription/route.ts
// Subscription tiers management

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Subscription tier definitions
const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    features: [
      '10 plays per day',
      '128kbps streaming',
      'Basic discovery',
      'Ad-supported',
    ],
    limits: {
      playsPerDay: 10,
      audioQuality: '128kbps',
      offlineDownloads: 0,
      skipLimit: 6,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    priceSOL: 0.5,
    priceUSDC: 4.99,
    interval: 'month',
    features: [
      'Unlimited plays',
      '256kbps streaming',
      'Ad-free listening',
      '5 offline downloads',
      'Basic analytics',
    ],
    limits: {
      playsPerDay: -1, // unlimited
      audioQuality: '256kbps',
      offlineDownloads: 5,
      skipLimit: -1,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceSOL: 1.5,
    priceUSDC: 14.99,
    interval: 'month',
    features: [
      'Everything in Basic',
      '320kbps streaming',
      'Unlimited offline downloads',
      'Early access (3 days)',
      'Exclusive content',
      'Priority support',
    ],
    limits: {
      playsPerDay: -1,
      audioQuality: '320kbps',
      offlineDownloads: -1,
      skipLimit: -1,
      earlyAccessDays: 3,
    },
  },
  whale: {
    id: 'whale',
    name: 'Whale',
    priceSOL: 5,
    priceUSDC: 49.99,
    interval: 'month',
    features: [
      'Everything in Premium',
      'FLAC/Lossless audio',
      'Early access (7 days)',
      'Artist meet & greets',
      'Governance voting',
      'VIP discord access',
      'Exclusive merch drops',
    ],
    limits: {
      playsPerDay: -1,
      audioQuality: 'flac',
      offlineDownloads: -1,
      skipLimit: -1,
      earlyAccessDays: 7,
    },
  },
};

// GET /api/subscription - Get subscription status or list tiers
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const action = searchParams.get('action') || 'status';

  // List all tiers
  if (action === 'tiers') {
    return NextResponse.json({
      tiers: Object.values(SUBSCRIPTION_TIERS),
    });
  }

  // Get user's subscription status
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return NextResponse.json({
        subscription: null,
        tier: SUBSCRIPTION_TIERS.free,
        isActive: false,
      });
    }

    const tier = SUBSCRIPTION_TIERS[subscription.tier as keyof typeof SUBSCRIPTION_TIERS] || SUBSCRIPTION_TIERS.free;

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      tier,
      isActive: true,
      daysRemaining: subscription.currentPeriodEnd
        ? Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Failed to get subscription' }, { status: 500 });
  }
}

// POST /api/subscription - Subscribe to a tier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tier, currency = 'SOL', txSignature } = body;

    if (!userId || !tier) {
      return NextResponse.json({ error: 'userId and tier required' }, { status: 400 });
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
    if (!tierConfig || tier === 'free') {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // Check for existing active subscription
    const existing = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (existing) {
      return NextResponse.json({ 
        error: 'Already subscribed', 
        subscription: existing 
      }, { status: 400 });
    }

    // Calculate period
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Get price based on currency
    const price = currency === 'SOL' 
      ? tierConfig.priceSOL 
      : tierConfig.priceUSDC;

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        tier,
        status: 'active',
        currency,
        amount: price || 0,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        txSignature,
      },
    });

    // Update user tier
    await prisma.user.update({
      where: { id: userId },
      data: { tier },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
      tierConfig,
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

// PATCH /api/subscription - Upgrade/downgrade or cancel
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, newTier, txSignature } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action required' }, { status: 400 });
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['active', 'trialing'] },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
    }

    if (action === 'cancel') {
      // Cancel at end of period
      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true },
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription will cancel at end of billing period',
        cancelAt: updated.currentPeriodEnd,
      });
    }

    if (action === 'reactivate') {
      // Remove cancellation
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription reactivated',
      });
    }

    if (action === 'change' && newTier) {
      const tierConfig = SUBSCRIPTION_TIERS[newTier as keyof typeof SUBSCRIPTION_TIERS];
      if (!tierConfig || newTier === 'free') {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
      }

      // Update subscription tier (effective immediately or at period end based on policy)
      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          tier: newTier,
          txSignature: txSignature || subscription.txSignature,
        },
      });

      // Update user tier
      await prisma.user.update({
        where: { id: userId },
        data: { tier: newTier },
      });

      return NextResponse.json({
        success: true,
        subscription: updated,
        tierConfig,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
