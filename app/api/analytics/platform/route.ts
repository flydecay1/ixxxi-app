// app/api/analytics/platform/route.ts
// Platform-wide analytics (admin dashboard)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get platform-wide analytics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const adminKey = request.headers.get('x-admin-key');

  // Basic admin check (in production, use proper auth)
  const isAdmin = adminKey === process.env.ADMIN_API_KEY;

  try {
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

    // Previous period for comparison
    const periodMs = now.getTime() - startDate.getTime();
    const previousStart = new Date(startDate.getTime() - periodMs);

    // Core counts
    const [
      totalUsers,
      totalArtists,
      totalTracks,
      verifiedArtists,
      publishedTracks,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.artist.count(),
      prisma.track.count(),
      prisma.artist.count({ where: { isVerified: true } }),
      prisma.track.count({ where: { status: 'published' } }),
    ]);

    // Period-specific counts
    const [
      newUsers,
      previousNewUsers,
      newArtists,
      previousNewArtists,
      newTracks,
      previousNewTracks,
      periodPlays,
      previousPlays,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.count({ where: { createdAt: { gte: previousStart, lt: startDate } } }),
      prisma.artist.count({ where: { createdAt: { gte: startDate } } }),
      prisma.artist.count({ where: { createdAt: { gte: previousStart, lt: startDate } } }),
      prisma.track.count({ where: { publishedAt: { gte: startDate }, status: 'published' } }),
      prisma.track.count({ where: { publishedAt: { gte: previousStart, lt: startDate }, status: 'published' } }),
      prisma.play.count({ where: { createdAt: { gte: startDate } } }),
      prisma.play.count({ where: { createdAt: { gte: previousStart, lt: startDate } } }),
    ]);

    // Revenue metrics
    const [currentRevenue, previousRevenue] = await Promise.all([
      prisma.purchase.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startDate },
        },
        _sum: { amount: true, platformFee: true },
        _count: { id: true },
      }),
      prisma.purchase.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: previousStart, lt: startDate },
        },
        _sum: { amount: true, platformFee: true },
        _count: { id: true },
      }),
    ]);

    // User tier distribution
    const tierDistribution = await prisma.user.groupBy({
      by: ['tier'],
      _count: { id: true },
    });

    const tiers = {
      free: 0,
      holder: 0,
      premium: 0,
      whale: 0,
    };

    for (const tier of tierDistribution) {
      tiers[tier.tier as keyof typeof tiers] = tier._count.id;
    }

    // Top performing content
    const topTracks = await prisma.track.findMany({
      where: { status: 'published' },
      orderBy: { playCount: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        ticker: true,
        coverUrl: true,
        playCount: true,
        likeCount: true,
        artist: {
          select: {
            id: true,
            name: true,
            isVerified: true,
          },
        },
      },
    });

    const topArtists = await prisma.artist.findMany({
      orderBy: { totalPlays: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isVerified: true,
        totalPlays: true,
        totalFollowers: true,
        totalTracks: true,
      },
    });

    // Genre distribution
    const genreStats = await prisma.track.groupBy({
      by: ['genre'],
      where: { 
        status: 'published',
        genre: { not: null },
      },
      _count: { id: true },
      _sum: { playCount: true },
    });

    const genreDistribution = genreStats
      .filter(g => g.genre)
      .map(g => ({
        genre: g.genre!,
        trackCount: g._count.id,
        totalPlays: g._sum.playCount || 0,
      }))
      .sort((a, b) => b.totalPlays - a.totalPlays)
      .slice(0, 10);

    // Daily activity chart
    const dailyStats = await prisma.play.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
    });

    // Aggregate by day
    const dailyAggregates = new Map<string, { plays: number; users: Set<string> }>();
    const allPlays = await prisma.play.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        createdAt: true,
        userId: true,
      },
    });

    for (const play of allPlays) {
      const dateStr = play.createdAt.toISOString().split('T')[0];
      if (!dailyAggregates.has(dateStr)) {
        dailyAggregates.set(dateStr, { plays: 0, users: new Set() });
      }
      const day = dailyAggregates.get(dateStr)!;
      day.plays++;
      if (play.userId) day.users.add(play.userId);
    }

    const chartData = Array.from(dailyAggregates.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        plays: stats.plays,
        activeUsers: stats.users.size,
      }));

    // Calculate growth percentages
    const calcGrowth = (current: number, previous: number) => 
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;

    // System health (if admin)
    let systemHealth = null;
    if (isAdmin) {
      const [
        failedTracks,
        pendingPurchases,
        recentErrors,
      ] = await Promise.all([
        prisma.track.count({ where: { status: 'failed' } }),
        prisma.purchase.count({ where: { status: 'PENDING' } }),
        prisma.track.count({ 
          where: { 
            processingError: { not: null },
            updatedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      systemHealth = {
        failedTracks,
        pendingPurchases,
        recentErrors,
        status: failedTracks + recentErrors < 5 ? 'healthy' : 'warning',
      };
    }

    return NextResponse.json({
      period,
      dateRange: {
        start: startDate,
        end: now,
      },

      // Overview
      overview: {
        totalUsers,
        totalArtists,
        totalTracks: publishedTracks,
        verifiedArtists,
        totalPlays: periodPlays,
      },

      // Growth metrics
      growth: {
        newUsers,
        userGrowth: calcGrowth(newUsers, previousNewUsers),
        newArtists,
        artistGrowth: calcGrowth(newArtists, previousNewArtists),
        newTracks,
        trackGrowth: calcGrowth(newTracks, previousNewTracks),
        plays: periodPlays,
        playGrowth: calcGrowth(periodPlays, previousPlays),
      },

      // Revenue
      revenue: {
        totalVolume: currentRevenue._sum.amount || 0,
        platformFees: currentRevenue._sum.platformFee || 0,
        transactions: currentRevenue._count.id,
        volumeGrowth: calcGrowth(
          currentRevenue._sum.amount || 0,
          previousRevenue._sum.amount || 0
        ),
      },

      // User distribution
      userTiers: {
        ...tiers,
        percentages: {
          free: totalUsers > 0 ? Math.round((tiers.free / totalUsers) * 100) : 0,
          holder: totalUsers > 0 ? Math.round((tiers.holder / totalUsers) * 100) : 0,
          premium: totalUsers > 0 ? Math.round((tiers.premium / totalUsers) * 100) : 0,
          whale: totalUsers > 0 ? Math.round((tiers.whale / totalUsers) * 100) : 0,
        },
      },

      // Content
      topTracks,
      topArtists,
      genreDistribution,

      // Chart data
      chartData: chartData.slice(-30), // Last 30 days

      // System health (admin only)
      ...(systemHealth ? { systemHealth } : {}),
    });

  } catch (error) {
    console.error('Platform analytics error:', error);
    return NextResponse.json({ error: 'Failed to get platform analytics' }, { status: 500 });
  }
}
