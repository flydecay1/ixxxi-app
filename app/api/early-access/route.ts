// app/api/early-access/route.ts
// Early access to new releases for premium tier holders

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkTokenBalance } from '@/lib/solana/tokenGate';

// Tier requirements for early access
const EARLY_ACCESS_TIERS = {
  whale: { minTokens: 10000, daysEarly: 7 },
  premium: { minTokens: 1000, daysEarly: 3 },
  holder: { minTokens: 100, daysEarly: 1 },
};

// GET - Get early access releases for user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet');
  const artistId = searchParams.get('artistId');

  try {
    // Determine user's tier
    let userTier = 'free';
    let daysEarly = 0;

    if (walletAddress) {
      const balance = await checkTokenBalance(walletAddress);
      
      if (balance >= EARLY_ACCESS_TIERS.whale.minTokens) {
        userTier = 'whale';
        daysEarly = EARLY_ACCESS_TIERS.whale.daysEarly;
      } else if (balance >= EARLY_ACCESS_TIERS.premium.minTokens) {
        userTier = 'premium';
        daysEarly = EARLY_ACCESS_TIERS.premium.daysEarly;
      } else if (balance >= EARLY_ACCESS_TIERS.holder.minTokens) {
        userTier = 'holder';
        daysEarly = EARLY_ACCESS_TIERS.holder.daysEarly;
      }
    }

    // Calculate cutoff dates
    const now = new Date();
    const publicReleaseDate = new Date(now);
    const earlyAccessDate = new Date(now);
    earlyAccessDate.setDate(earlyAccessDate.getDate() + daysEarly);

    // Build query for scheduled releases
    const whereClause: any = {
      status: 'scheduled',
      scheduledReleaseAt: {
        lte: earlyAccessDate, // Available for user based on their tier
        gt: publicReleaseDate, // Not yet public
      },
    };

    if (artistId) {
      whereClause.artistId = artistId;
    }

    // Get tracks available for early access
    const earlyAccessTracks = await prisma.track.findMany({
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
      orderBy: { scheduledReleaseAt: 'asc' },
    });

    // Get upcoming releases user doesn't have access to yet
    const upcomingReleases = await prisma.track.findMany({
      where: {
        status: 'scheduled',
        scheduledReleaseAt: {
          gt: earlyAccessDate, // Beyond user's early access window
        },
        ...(artistId ? { artistId } : {}),
      },
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
      orderBy: { scheduledReleaseAt: 'asc' },
      take: 10,
    });

    return NextResponse.json({
      tier: userTier,
      daysEarly,
      earlyAccess: earlyAccessTracks.map(t => ({
        id: t.id,
        title: t.title,
        ticker: t.ticker,
        coverUrl: t.coverUrl,
        duration: t.duration,
        scheduledReleaseAt: t.scheduledReleaseAt,
        publicReleaseAt: t.scheduledReleaseAt, // When it goes public
        artist: t.artist,
        availableNow: true,
      })),
      upcoming: upcomingReleases.map(t => {
        // Calculate what tier is needed for access now
        const daysUntilRelease = Math.ceil(
          (new Date(t.scheduledReleaseAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        let requiredTier = 'none';
        if (daysUntilRelease <= EARLY_ACCESS_TIERS.holder.daysEarly) {
          requiredTier = 'holder';
        } else if (daysUntilRelease <= EARLY_ACCESS_TIERS.premium.daysEarly) {
          requiredTier = 'premium';
        } else if (daysUntilRelease <= EARLY_ACCESS_TIERS.whale.daysEarly) {
          requiredTier = 'whale';
        }

        return {
          id: t.id,
          title: t.title,
          ticker: t.ticker,
          coverUrl: t.coverUrl,
          scheduledReleaseAt: t.scheduledReleaseAt,
          artist: t.artist,
          daysUntilAccess: daysUntilRelease - daysEarly,
          daysUntilPublic: daysUntilRelease,
          requiredTierForNow: requiredTier,
          availableNow: false,
        };
      }),
      tierBenefits: EARLY_ACCESS_TIERS,
    });

  } catch (error) {
    console.error('Early access error:', error);
    return NextResponse.json({ error: 'Failed to get early access releases' }, { status: 500 });
  }
}

// POST - Schedule a track for early access release (artist only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, trackId, scheduledReleaseAt, earlyAccessDays = 3 } = body;

    if (!walletAddress || !trackId || !scheduledReleaseAt) {
      return NextResponse.json({ 
        error: 'Wallet address, track ID, and release date required' 
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

    // Validate release date is in the future
    const releaseDate = new Date(scheduledReleaseAt);
    if (releaseDate <= new Date()) {
      return NextResponse.json({ 
        error: 'Release date must be in the future' 
      }, { status: 400 });
    }

    // Update track with scheduled release
    const updatedTrack = await prisma.track.update({
      where: { id: trackId },
      data: {
        status: 'scheduled',
        scheduledReleaseAt: releaseDate,
        earlyAccessDays: Math.min(Math.max(earlyAccessDays, 1), 7), // 1-7 days
      },
    });

    // Calculate tier access dates
    const tierAccessDates = {
      whale: new Date(releaseDate.getTime() - EARLY_ACCESS_TIERS.whale.daysEarly * 24 * 60 * 60 * 1000),
      premium: new Date(releaseDate.getTime() - EARLY_ACCESS_TIERS.premium.daysEarly * 24 * 60 * 60 * 1000),
      holder: new Date(releaseDate.getTime() - EARLY_ACCESS_TIERS.holder.daysEarly * 24 * 60 * 60 * 1000),
      public: releaseDate,
    };

    return NextResponse.json({
      success: true,
      track: {
        id: updatedTrack.id,
        title: updatedTrack.title,
        ticker: updatedTrack.ticker,
        status: updatedTrack.status,
        scheduledReleaseAt: updatedTrack.scheduledReleaseAt,
      },
      accessSchedule: tierAccessDates,
      message: `Track scheduled for release on ${releaseDate.toLocaleDateString()}`,
    });

  } catch (error) {
    console.error('Schedule early access error:', error);
    return NextResponse.json({ error: 'Failed to schedule release' }, { status: 500 });
  }
}

// DELETE - Cancel scheduled release
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, trackId } = body;

    if (!walletAddress || !trackId) {
      return NextResponse.json({ error: 'Wallet address and track ID required' }, { status: 400 });
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
        status: 'scheduled',
      },
    });

    if (!track) {
      return NextResponse.json({ error: 'Scheduled track not found' }, { status: 404 });
    }

    // Cancel scheduled release (revert to draft)
    const updatedTrack = await prisma.track.update({
      where: { id: trackId },
      data: {
        status: 'draft',
        scheduledReleaseAt: null,
        earlyAccessDays: null,
      },
    });

    return NextResponse.json({
      success: true,
      track: {
        id: updatedTrack.id,
        title: updatedTrack.title,
        status: updatedTrack.status,
      },
      message: 'Scheduled release cancelled',
    });

  } catch (error) {
    console.error('Cancel release error:', error);
    return NextResponse.json({ error: 'Failed to cancel release' }, { status: 500 });
  }
}
