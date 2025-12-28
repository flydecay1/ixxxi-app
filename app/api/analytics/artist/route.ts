// app/api/artist/dashboard/route.ts
// Artist analytics dashboard API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get comprehensive artist analytics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet');
  const period = searchParams.get('period') || '30d'; // '7d' | '30d' | '90d' | '1y' | 'all'

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

  try {
    // Get artist
    const artist = await prisma.artist.findFirst({
      where: { wallet: walletAddress },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
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
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    // Get previous period for comparison
    const periodMs = now.getTime() - startDate.getTime();
    const previousStart = new Date(startDate.getTime() - periodMs);
    const previousEnd = startDate;

    // Get all tracks for artist
    const tracks = await prisma.track.findMany({
      where: { artistId: artist.id },
      select: {
        id: true,
        title: true,
        ticker: true,
        coverUrl: true,
        playCount: true,
        likeCount: true,
        stakeCount: true,
        totalRevenue: true,
        publishedAt: true,
        status: true,
      },
    });

    const trackIds = tracks.map(t => t.id);

    // Get plays for current period
    const [currentPlays, previousPlays] = await Promise.all([
      prisma.play.findMany({
        where: {
          trackId: { in: trackIds },
          createdAt: { gte: startDate },
        },
        include: {
          user: {
            select: {
              id: true,
              tier: true,
              walletAddress: true,
            },
          },
          track: {
            select: {
              id: true,
              genre: true,
              duration: true,
            },
          },
        },
      }),
      prisma.play.count({
        where: {
          trackId: { in: trackIds },
          createdAt: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    // Calculate current period stats
    const totalPlays = currentPlays.length;
    const uniqueListeners = new Set(currentPlays.filter(p => p.userId).map(p => p.userId)).size;
    const totalListenTime = currentPlays.reduce((sum, p) => sum + (p.duration || 0), 0);
    const completedPlays = currentPlays.filter(p => p.completed).length;
    const completionRate = totalPlays > 0 ? (completedPlays / totalPlays) * 100 : 0;

    // Growth calculations
    const playGrowth = previousPlays > 0 
      ? ((totalPlays - previousPlays) / previousPlays) * 100 
      : totalPlays > 0 ? 100 : 0;

    // Get followers
    const user = await prisma.user.findFirst({
      where: { id: artist.userId },
    });

    const [followerCount, previousFollowers] = await Promise.all([
      prisma.follow.count({
        where: { followingId: user?.id },
      }),
      prisma.follow.count({
        where: {
          followingId: user?.id,
          createdAt: { lt: startDate },
        },
      }),
    ]);

    const newFollowers = followerCount - previousFollowers;

    // Track performance
    const trackPerformance = tracks.map(track => {
      const trackPlays = currentPlays.filter(p => p.trackId === track.id);
      return {
        id: track.id,
        title: track.title,
        ticker: track.ticker,
        coverUrl: track.coverUrl,
        plays: trackPlays.length,
        uniqueListeners: new Set(trackPlays.filter(p => p.userId).map(p => p.userId)).size,
        completionRate: trackPlays.length > 0 
          ? (trackPlays.filter(p => p.completed).length / trackPlays.length) * 100 
          : 0,
        avgListenDuration: trackPlays.length > 0
          ? trackPlays.reduce((sum, p) => sum + (p.duration || 0), 0) / trackPlays.length
          : 0,
        totalRevenue: track.totalRevenue,
        likes: track.likeCount,
        stakes: track.stakeCount,
        status: track.status,
      };
    }).sort((a, b) => b.plays - a.plays);

    // Revenue breakdown
    const purchases = await prisma.purchase.findMany({
      where: {
        trackId: { in: trackIds },
        status: 'COMPLETED',
        createdAt: { gte: startDate },
      },
    });

    const revenue = {
      total: purchases.reduce((sum, p) => sum + (p.artistAmount || 0), 0),
      purchases: purchases.reduce((sum, p) => sum + (p.amount || 0), 0),
      platformFees: purchases.reduce((sum, p) => sum + (p.platformFee || 0), 0),
      byTrack: trackIds.map(id => {
        const trackPurchases = purchases.filter(p => p.trackId === id);
        return {
          trackId: id,
          revenue: trackPurchases.reduce((sum, p) => sum + (p.artistAmount || 0), 0),
          sales: trackPurchases.length,
        };
      }).filter(t => t.revenue > 0),
    };

    // Audience demographics
    const tierBreakdown = {
      whale: 0,
      premium: 0,
      holder: 0,
      free: 0,
    };

    for (const play of currentPlays) {
      if (play.user?.tier) {
        tierBreakdown[play.user.tier as keyof typeof tierBreakdown]++;
      } else {
        tierBreakdown.free++;
      }
    }

    // Genre breakdown of listeners
    const genrePlays = new Map<string, number>();
    for (const play of currentPlays) {
      if (play.track.genre) {
        genrePlays.set(play.track.genre, (genrePlays.get(play.track.genre) || 0) + 1);
      }
    }

    // Daily chart data
    const dailyData = new Map<string, { plays: number; listeners: Set<string>; listenTime: number }>();
    
    for (const play of currentPlays) {
      const dateStr = play.createdAt.toISOString().split('T')[0];
      if (!dailyData.has(dateStr)) {
        dailyData.set(dateStr, { plays: 0, listeners: new Set(), listenTime: 0 });
      }
      const day = dailyData.get(dateStr)!;
      day.plays++;
      if (play.userId) day.listeners.add(play.userId);
      day.listenTime += play.duration || 0;
    }

    // Generate chart data
    const chartData = [];
    const dayCount = Math.min(
      Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
      period === '1y' ? 52 : 90 // Weeks for yearly, days otherwise
    );

    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStats = dailyData.get(dateStr);
      
      chartData.push({
        date: dateStr,
        label: date.toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        plays: dayStats?.plays || 0,
        listeners: dayStats?.listeners.size || 0,
        listenTime: dayStats?.listenTime || 0,
      });
    }

    // Peak listening times
    const hourlyPlays = new Array(24).fill(0);
    for (const play of currentPlays) {
      hourlyPlays[play.createdAt.getHours()]++;
    }

    const peakHours = hourlyPlays
      .map((plays, hour) => ({ hour, plays }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 3);

    return NextResponse.json({
      artist: {
        id: artist.id,
        name: artist.name,
        avatarUrl: artist.avatarUrl,
        isVerified: artist.isVerified,
        totalTracks: tracks.length,
        publishedTracks: tracks.filter(t => t.status === 'published').length,
      },
      period,
      dateRange: {
        start: startDate,
        end: now,
      },

      // Overview metrics
      metrics: {
        totalPlays,
        playGrowth: Math.round(playGrowth),
        uniqueListeners,
        totalListenTime,
        formattedListenTime: formatDuration(totalListenTime),
        completionRate: Math.round(completionRate),
        followerCount,
        newFollowers,
        averagePlaysPerTrack: tracks.length > 0 ? Math.round(totalPlays / tracks.length) : 0,
      },

      // Revenue
      revenue,

      // Track performance
      trackPerformance: trackPerformance.slice(0, 10), // Top 10

      // Audience insights
      audience: {
        tierBreakdown,
        tierPercentages: {
          whale: totalPlays > 0 ? Math.round((tierBreakdown.whale / totalPlays) * 100) : 0,
          premium: totalPlays > 0 ? Math.round((tierBreakdown.premium / totalPlays) * 100) : 0,
          holder: totalPlays > 0 ? Math.round((tierBreakdown.holder / totalPlays) * 100) : 0,
          free: totalPlays > 0 ? Math.round((tierBreakdown.free / totalPlays) * 100) : 0,
        },
        genreBreakdown: Array.from(genrePlays.entries())
          .map(([genre, plays]) => ({ genre, plays }))
          .sort((a, b) => b.plays - a.plays)
          .slice(0, 5),
        peakHours: peakHours.map(h => ({
          hour: h.hour,
          label: `${h.hour % 12 || 12}:00 ${h.hour >= 12 ? 'PM' : 'AM'}`,
          plays: h.plays,
        })),
      },

      // Chart data
      chartData,
    });

  } catch (error) {
    console.error('Artist dashboard error:', error);
    return NextResponse.json({ error: 'Failed to get dashboard data' }, { status: 500 });
  }
}

// Helper function
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
