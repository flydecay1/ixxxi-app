// app/api/exclusive/route.ts
// Exclusive content gating by token tier

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkTokenBalance } from '@/lib/solana/tokenGate';

// Content access tiers
const CONTENT_TIERS = {
  free: { minTokens: 0, label: 'Free' },
  holder: { minTokens: 100, label: 'Holder' },
  premium: { minTokens: 1000, label: 'Premium' },
  whale: { minTokens: 10000, label: 'Whale' },
};

type TierKey = keyof typeof CONTENT_TIERS;

// GET - Get exclusive content based on user tier
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet');
  const artistId = searchParams.get('artistId');
  const contentType = searchParams.get('type'); // 'tracks' | 'behind-scenes' | 'live' | 'merch'
  const tierFilter = searchParams.get('tier') as TierKey | null;

  try {
    // Determine user's tier
    let userTier: TierKey = 'free';
    let tokenBalance = 0;

    if (walletAddress) {
      tokenBalance = await checkTokenBalance(walletAddress);
      
      if (tokenBalance >= CONTENT_TIERS.whale.minTokens) {
        userTier = 'whale';
      } else if (tokenBalance >= CONTENT_TIERS.premium.minTokens) {
        userTier = 'premium';
      } else if (tokenBalance >= CONTENT_TIERS.holder.minTokens) {
        userTier = 'holder';
      }
    }

    // Get accessible tiers for user
    const accessibleTiers = Object.entries(CONTENT_TIERS)
      .filter(([_, tier]) => tier.minTokens <= tokenBalance)
      .map(([key]) => key as TierKey);

    // Build query for exclusive content
    const whereClause: any = {
      status: 'published',
      isExclusive: true,
    };

    if (artistId) {
      whereClause.artistId = artistId;
    }

    if (tierFilter) {
      whereClause.requiredTier = tierFilter;
    }

    // Get exclusive tracks
    const exclusiveTracks = await prisma.track.findMany({
      where: whereClause,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Categorize by access
    const accessible = exclusiveTracks.filter(t => 
      accessibleTiers.includes((t.requiredTier || 'free') as TierKey)
    );

    const locked = exclusiveTracks.filter(t => 
      !accessibleTiers.includes((t.requiredTier || 'free') as TierKey)
    );

    // Get exclusive content counts by tier
    const tierCounts = await Promise.all(
      Object.keys(CONTENT_TIERS).map(async (tier) => {
        const count = await prisma.track.count({
          where: {
            isExclusive: true,
            requiredTier: tier,
            status: 'published',
            ...(artistId ? { artistId } : {}),
          },
        });
        return { tier, count };
      })
    );

    // Format response
    return NextResponse.json({
      userTier,
      tokenBalance,
      accessibleTiers,
      content: {
        accessible: accessible.map(t => ({
          id: t.id,
          title: t.title,
          ticker: t.ticker,
          coverUrl: t.coverUrl,
          duration: t.duration,
          requiredTier: t.requiredTier || 'free',
          artist: t.artist,
          playCount: t.playCount,
          likeCount: t.likeCount,
          canAccess: true,
        })),
        locked: locked.map(t => ({
          id: t.id,
          title: t.title,
          ticker: t.ticker,
          coverUrl: t.coverUrl,
          requiredTier: t.requiredTier || 'holder',
          artist: t.artist,
          canAccess: false,
          tokensNeeded: CONTENT_TIERS[(t.requiredTier || 'holder') as TierKey].minTokens - tokenBalance,
        })),
      },
      tierCounts: Object.fromEntries(tierCounts.map(({ tier, count }) => [tier, count])),
      tiers: CONTENT_TIERS,
    });

  } catch (error) {
    console.error('Get exclusive content error:', error);
    return NextResponse.json({ error: 'Failed to get exclusive content' }, { status: 500 });
  }
}

// POST - Set content as exclusive (artist only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, trackId, requiredTier = 'holder', isExclusive = true } = body;

    if (!walletAddress || !trackId) {
      return NextResponse.json({ 
        error: 'Wallet address and track ID required' 
      }, { status: 400 });
    }

    // Validate tier
    if (!Object.keys(CONTENT_TIERS).includes(requiredTier)) {
      return NextResponse.json({ 
        error: 'Invalid tier. Must be: free, holder, premium, or whale' 
      }, { status: 400 });
    }

    // Verify artist owns the track
    const artist = await prisma.artist.findFirst({
      where: { walletAddress },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    const track = await prisma.track.findFirst({
      where: { 
        id: trackId,
        artistId: artist.id,
      },
    });

    if (!track) {
      return NextResponse.json({ error: 'Track not found or unauthorized' }, { status: 404 });
    }

    // Update track exclusivity
    const updatedTrack = await prisma.track.update({
      where: { id: trackId },
      data: {
        isExclusive,
        requiredTier: isExclusive ? requiredTier : null,
      },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      track: {
        id: updatedTrack.id,
        title: updatedTrack.title,
        ticker: updatedTrack.ticker,
        isExclusive: updatedTrack.isExclusive,
        requiredTier: updatedTrack.requiredTier,
        artist: updatedTrack.artist,
      },
      accessInfo: isExclusive ? {
        tier: requiredTier,
        minTokens: CONTENT_TIERS[requiredTier as TierKey].minTokens,
        label: CONTENT_TIERS[requiredTier as TierKey].label,
      } : null,
      message: isExclusive 
        ? `Track set as ${requiredTier} exclusive content`
        : 'Track set as public content',
    });

  } catch (error) {
    console.error('Set exclusive error:', error);
    return NextResponse.json({ error: 'Failed to set exclusive content' }, { status: 500 });
  }
}

// PATCH - Update exclusive tier for content
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, trackId, requiredTier } = body;

    if (!walletAddress || !trackId || !requiredTier) {
      return NextResponse.json({ 
        error: 'Wallet address, track ID, and required tier needed' 
      }, { status: 400 });
    }

    if (!Object.keys(CONTENT_TIERS).includes(requiredTier)) {
      return NextResponse.json({ 
        error: 'Invalid tier. Must be: free, holder, premium, or whale' 
      }, { status: 400 });
    }

    // Verify artist owns the track
    const artist = await prisma.artist.findFirst({
      where: { walletAddress },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    const track = await prisma.track.findFirst({
      where: { 
        id: trackId,
        artistId: artist.id,
        isExclusive: true,
      },
    });

    if (!track) {
      return NextResponse.json({ 
        error: 'Exclusive track not found or unauthorized' 
      }, { status: 404 });
    }

    // Update tier
    const updatedTrack = await prisma.track.update({
      where: { id: trackId },
      data: { requiredTier },
    });

    return NextResponse.json({
      success: true,
      track: {
        id: updatedTrack.id,
        title: updatedTrack.title,
        requiredTier: updatedTrack.requiredTier,
      },
      accessInfo: {
        tier: requiredTier,
        minTokens: CONTENT_TIERS[requiredTier as TierKey].minTokens,
        label: CONTENT_TIERS[requiredTier as TierKey].label,
      },
      message: `Track tier updated to ${requiredTier}`,
    });

  } catch (error) {
    console.error('Update exclusive tier error:', error);
    return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 });
  }
}
