// app/api/artist/dashboard/route.ts
// Artist dashboard API - analytics, earnings, track management

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublicKey } from '@solana/web3.js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const period = searchParams.get('period') || '30d';

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Get user and artist profile
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.artist) {
      return NextResponse.json({ error: 'Not an artist account' }, { status: 403 });
    }

    const artist = user.artist;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    // Get all tracks with play counts
    const tracks = await prisma.track.findMany({
      where: { artistId: artist.id },
      include: {
        _count: { select: { plays: true, likes: true } },
        plays: {
          where: { createdAt: { gte: startDate } },
          select: { duration: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate track analytics
    const trackAnalytics = tracks.map(track => {
      const periodPlays = track.plays.length;
      const periodDuration = track.plays.reduce((acc, p) => acc + p.duration, 0);
      
      return {
        id: track.id,
        title: track.title,
        coverUrl: track.coverUrl,
        isPublished: track.status === 'published',
        gateType: track.gateType,
        totalPlays: track._count.plays,
        totalLikes: track._count.likes,
        periodPlays,
        periodDuration,
        createdAt: track.createdAt,
      };
    });

    // Get total plays in period
    const totalPlays = await prisma.play.count({
      where: {
        track: { artistId: artist.id },
        createdAt: { gte: startDate }
      }
    });

    // Get unique listeners
    const uniqueListeners = await prisma.play.findMany({
      where: {
        track: { artistId: artist.id },
        createdAt: { gte: startDate }
      },
      distinct: ['userId'],
      select: { userId: true }
    });

    // Get stakers on artist's tracks
    const stakes = await prisma.stake.findMany({
      where: {
        track: { artistId: artist.id }
      },
      include: {
        user: {
          select: { walletAddress: true, username: true, avatarUrl: true }
        }
      },
      orderBy: { amount: 'desc' }
    });

    const totalStaked = stakes.reduce((acc, s) => acc + s.amount, 0);

    // Get follower count
    const followers = await prisma.follow.count({
      where: { followingId: user.id }
    });

    // Calculate earnings (simplified - in production this would come from on-chain data)
    const estimatedEarnings = totalPlays * 0.001; // $0.001 per play estimate

    return NextResponse.json({
      artist: {
        id: artist.id,
        name: artist.name,
        bio: artist.bio,
        avatarUrl: artist.avatarUrl,
        headerUrl: artist.bannerUrl,
        isVerified: artist.isVerified,
        totalTracks: tracks.length,
        publishedTracks: tracks.filter(t => t.status === 'published').length,
      },
      analytics: {
        period,
        totalPlays,
        uniqueListeners: uniqueListeners.length,
        totalStaked,
        stakerCount: stakes.length,
        followers,
        estimatedEarnings,
      },
      tracks: trackAnalytics,
      topStakers: stakes.slice(0, 10).map(s => ({
        user: s.user,
        amount: s.amount,
        stakedAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('GET artist dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
