// app/api/user/tier/route.ts
// User tier verification and auto-upgrade based on token holdings

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
const IXXXI_TOKEN_MINT = process.env.IXXXI_TOKEN_MINT;

// Tier thresholds (in IXXXI tokens)
const TIER_THRESHOLDS = {
  free: 0,
  holder: 100,      // 100+ tokens
  premium: 1000,    // 1,000+ tokens
  whale: 10000,     // 10,000+ tokens
};

const TIER_BENEFITS = {
  free: {
    name: 'Free',
    maxPlays: 10,           // Per day
    canSkip: false,
    offlineAccess: false,
    earlyAccess: false,
    exclusiveContent: false,
    adFree: false,
    highQuality: false,
    discount: 0,
  },
  holder: {
    name: 'Holder',
    maxPlays: 100,
    canSkip: true,
    offlineAccess: false,
    earlyAccess: false,
    exclusiveContent: false,
    adFree: true,
    highQuality: true,
    discount: 5,            // 5% discount on purchases
  },
  premium: {
    name: 'Premium',
    maxPlays: Infinity,
    canSkip: true,
    offlineAccess: true,
    earlyAccess: true,
    exclusiveContent: true,
    adFree: true,
    highQuality: true,
    discount: 15,           // 15% discount
  },
  whale: {
    name: 'Whale',
    maxPlays: Infinity,
    canSkip: true,
    offlineAccess: true,
    earlyAccess: true,
    exclusiveContent: true,
    adFree: true,
    highQuality: true,
    discount: 25,           // 25% discount
    vipSupport: true,
    governanceVoting: true,
    airdrops: true,
  },
};

/**
 * Get user's token balance from on-chain
 */
async function getTokenBalance(walletAddress: string): Promise<number> {
  if (!IXXXI_TOKEN_MINT) return 0;
  
  try {
    const connection = new Connection(RPC_ENDPOINT);
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(IXXXI_TOKEN_MINT);
    
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const account = await getAccount(connection, ata);
    
    // Assuming 9 decimals for IXXXI token
    return Number(account.amount) / 1e9;
  } catch {
    // Account doesn't exist or error
    return 0;
  }
}

/**
 * Determine tier from token balance
 */
function getTierFromBalance(balance: number): keyof typeof TIER_THRESHOLDS {
  if (balance >= TIER_THRESHOLDS.whale) return 'whale';
  if (balance >= TIER_THRESHOLDS.premium) return 'premium';
  if (balance >= TIER_THRESHOLDS.holder) return 'holder';
  return 'free';
}

// GET - Check/refresh user tier
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json(
      { error: 'Wallet address required' },
      { status: 400 }
    );
  }

  try {
    // Get on-chain balance
    const balance = await getTokenBalance(wallet);
    const calculatedTier = getTierFromBalance(balance);

    // Get user from DB
    let user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
      select: {
        id: true,
        tier: true,
        tokenBalance: true,
        updatedAt: true,
      },
    });

    let tierUpdated = false;

    // Create or update user
    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: wallet,
          tier: calculatedTier,
          tokenBalance: balance,
        },
        select: {
          id: true,
          tier: true,
          tokenBalance: true,
          updatedAt: true,
        },
      });
      tierUpdated = true;
    } else if (user.tier !== calculatedTier || user.tokenBalance !== balance) {
      // Update if tier or balance changed
      await prisma.user.update({
        where: { walletAddress: wallet },
        data: {
          tier: calculatedTier,
          tokenBalance: balance,
        },
      });
      tierUpdated = user.tier !== calculatedTier;
      user.tier = calculatedTier;
      user.tokenBalance = balance;
    }

    // Calculate next tier requirements
    let nextTier: string | null = null;
    let tokensToNextTier: number | null = null;

    if (calculatedTier === 'free') {
      nextTier = 'holder';
      tokensToNextTier = TIER_THRESHOLDS.holder - balance;
    } else if (calculatedTier === 'holder') {
      nextTier = 'premium';
      tokensToNextTier = TIER_THRESHOLDS.premium - balance;
    } else if (calculatedTier === 'premium') {
      nextTier = 'whale';
      tokensToNextTier = TIER_THRESHOLDS.whale - balance;
    }

    return NextResponse.json({
      wallet,
      tier: calculatedTier,
      tierName: TIER_BENEFITS[calculatedTier].name,
      benefits: TIER_BENEFITS[calculatedTier],
      tokenBalance: balance,
      tierUpdated,
      nextTier: nextTier ? {
        tier: nextTier,
        name: TIER_BENEFITS[nextTier as keyof typeof TIER_BENEFITS].name,
        tokensRequired: tokensToNextTier,
      } : null,
      allTiers: Object.entries(TIER_THRESHOLDS).map(([tier, threshold]) => ({
        tier,
        name: TIER_BENEFITS[tier as keyof typeof TIER_BENEFITS].name,
        threshold,
        benefits: TIER_BENEFITS[tier as keyof typeof TIER_BENEFITS],
        current: tier === calculatedTier,
      })),
    });

  } catch (error) {
    console.error('Tier check error:', error);
    return NextResponse.json(
      { error: 'Failed to check tier' },
      { status: 500 }
    );
  }
}

// POST - Force refresh tier (e.g., after token purchase)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet } = body;

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Get fresh on-chain balance
    const balance = await getTokenBalance(wallet);
    const calculatedTier = getTierFromBalance(balance);

    // Update user in DB
    const user = await prisma.user.upsert({
      where: { walletAddress: wallet },
      update: {
        tier: calculatedTier,
        tokenBalance: balance,
      },
      create: {
        walletAddress: wallet,
        tier: calculatedTier,
        tokenBalance: balance,
      },
    });

    return NextResponse.json({
      success: true,
      wallet,
      tier: calculatedTier,
      tierName: TIER_BENEFITS[calculatedTier].name,
      tokenBalance: balance,
      benefits: TIER_BENEFITS[calculatedTier],
    });

  } catch (error) {
    console.error('Tier refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh tier' },
      { status: 500 }
    );
  }
}
