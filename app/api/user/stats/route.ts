// app/api/user/stats/route.ts
// User statistics API - plays, stakes, earnings, activity

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublicKey } from '@solana/web3.js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, all

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

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

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        tier: true,
        tokenBalance: true,
        createdAt: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get listening stats
    const plays = await prisma.play.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: startDate }
      },
      include: {
        track: {
          select: {
            id: true,
            title: true,
            artist: {
              select: { name: true, avatarUrl: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate listening time
    const totalListeningTime = plays.reduce((acc, play) => acc + play.duration, 0);

    // Get unique artists listened to
    const uniqueArtists = new Set(plays.map(p => p.track.artist.name));

    // Get most played tracks
    const trackPlays = plays.reduce((acc, play) => {
      const trackId = play.trackId;
      if (!acc[trackId]) {
        acc[trackId] = { track: play.track, count: 0, duration: 0 };
      }
      acc[trackId].count++;
      acc[trackId].duration += play.duration;
      return acc;
    }, {} as Record<string, { track: typeof plays[0]['track'], count: number, duration: number }>);

    const topTracks = Object.values(trackPlays)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get staking stats - stakes are on tracks
    const stakes = await prisma.stake.findMany({
      where: {
        userId: user.id,
      },
      include: {
        track: {
          select: { 
            id: true, 
            title: true, 
            coverUrl: true,
            artist: { select: { id: true, name: true, avatarUrl: true } }
          }
        }
      }
    });

    const totalStaked = stakes.reduce((acc, stake) => acc + stake.amount, 0);
    const totalEarnings = stakes.reduce((acc, stake) => acc + stake.rewardsEarned, 0);

    // Get following stats
    const following = await prisma.follow.count({
      where: { followerId: user.id }
    });

    const followers = await prisma.follow.count({
      where: { followingId: user.id }
    });

    // Get likes count
    const likes = await prisma.like.count({
      where: { userId: user.id }
    });

    // Get playlists
    const playlists = await prisma.playlist.count({
      where: { userId: user.id }
    });

    return NextResponse.json({
      user: {
        walletAddress: user.walletAddress,
        username: user.username,
        tier: user.tier,
        tokenBalance: user.tokenBalance,
        memberSince: user.createdAt,
      },
      listening: {
        period,
        totalPlays: plays.length,
        totalListeningTime,
        uniqueArtists: uniqueArtists.size,
        topTracks,
        recentPlays: plays.slice(0, 20),
      },
      staking: {
        activeStakes: stakes.length,
        totalStaked,
        totalEarnings,
        stakes: stakes.map(s => ({
          track: s.track,
          amount: s.amount,
          earned: s.rewardsEarned,
          stakedAt: s.createdAt,
        })),
      },
      social: {
        following,
        followers,
        likes,
        playlists,
      }
    });
  } catch (error) {
    console.error('GET user stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
