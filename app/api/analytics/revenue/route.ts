// app/api/analytics/revenue/route.ts
// Revenue analytics and tracking

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get revenue analytics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet');
  const artistId = searchParams.get('artistId');
  const period = searchParams.get('period') || '30d';
  const groupBy = searchParams.get('groupBy') || 'day'; // 'day' | 'week' | 'month'

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

    // Build filter
    let trackFilter: { id: { in: string[] } } | undefined;
    
    if (artistId) {
      const tracks = await prisma.track.findMany({
        where: { artistId },
        select: { id: true },
      });
      trackFilter = { id: { in: tracks.map(t => t.id) } };
    } else if (walletAddress) {
      const artist = await prisma.artist.findFirst({
        where: { wallet: walletAddress },
        include: {
          tracks: {
            select: { id: true },
          },
        },
      });
      
      if (!artist) {
        return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
      }
      
      trackFilter = { id: { in: artist.tracks.map(t => t.id) } };
    }

    // Get all purchases for the period
    const purchases = await prisma.purchase.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate },
        ...(trackFilter ? { track: trackFilter } : {}),
      },
      include: {
        track: {
          select: {
            id: true,
            title: true,
            ticker: true,
            artistId: true,
            artist: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get transactions for additional revenue types
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'confirmed',
        type: { in: ['purchase', 'royalty', 'stake'] },
        ...(walletAddress ? { wallet: walletAddress } : {}),
      },
    });

    // Calculate totals
    const totalRevenue = purchases.reduce((sum, p) => sum + (p.artistAmount || 0), 0);
    const totalSales = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const platformFees = purchases.reduce((sum, p) => sum + (p.platformFee || 0), 0);
    const purchaseCount = purchases.length;

    // Revenue by currency
    const byCurrency: Record<string, { total: number; count: number }> = {};
    for (const purchase of purchases) {
      if (!byCurrency[purchase.currency]) {
        byCurrency[purchase.currency] = { total: 0, count: 0 };
      }
      byCurrency[purchase.currency].total += purchase.amount;
      byCurrency[purchase.currency].count++;
    }

    // Revenue by track
    const byTrack = new Map<string, {
      track: typeof purchases[0]['track'];
      revenue: number;
      sales: number;
    }>();

    for (const purchase of purchases) {
      const trackId = purchase.trackId;
      if (!byTrack.has(trackId)) {
        byTrack.set(trackId, {
          track: purchase.track,
          revenue: 0,
          sales: 0,
        });
      }
      const trackStats = byTrack.get(trackId)!;
      trackStats.revenue += purchase.artistAmount || 0;
      trackStats.sales++;
    }

    const topTracks = Array.from(byTrack.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Time series data
    const timeSeriesData = new Map<string, {
      revenue: number;
      sales: number;
      purchases: number;
    }>();

    for (const purchase of purchases) {
      let key: string;
      const date = purchase.createdAt;
      
      if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = date.toISOString().substring(0, 7);
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!timeSeriesData.has(key)) {
        timeSeriesData.set(key, { revenue: 0, sales: 0, purchases: 0 });
      }
      const period = timeSeriesData.get(key)!;
      period.revenue += purchase.artistAmount || 0;
      period.sales += purchase.amount;
      period.purchases++;
    }

    // Sort and format chart data
    const chartData = Array.from(timeSeriesData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        label: formatDateLabel(date, groupBy),
        ...stats,
      }));

    // Recent transactions
    const recentTransactions = purchases.slice(0, 20).map(p => ({
      id: p.id,
      type: 'purchase',
      amount: p.amount,
      artistAmount: p.artistAmount,
      currency: p.currency,
      track: {
        id: p.track.id,
        title: p.track.title,
        ticker: p.track.ticker,
      },
      date: p.createdAt,
      txSignature: p.txSignature,
    }));

    // Calculate averages
    const avgTransactionValue = purchaseCount > 0 ? totalSales / purchaseCount : 0;
    const avgDailyRevenue = chartData.length > 0 
      ? totalRevenue / chartData.length 
      : 0;

    // Growth comparison (vs previous period)
    const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    
    const previousPurchases = await prisma.purchase.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: previousStartDate, lt: startDate },
        ...(trackFilter ? { track: trackFilter } : {}),
      },
      _sum: { artistAmount: true },
      _count: { id: true },
    });

    const previousRevenue = previousPurchases._sum.artistAmount || 0;
    const revenueGrowth = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : totalRevenue > 0 ? 100 : 0;

    return NextResponse.json({
      period,
      dateRange: {
        start: startDate,
        end: now,
      },

      // Summary
      summary: {
        totalRevenue,
        totalSales,
        platformFees,
        purchaseCount,
        avgTransactionValue: Math.round(avgTransactionValue * 100) / 100,
        avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
        revenueGrowth: Math.round(revenueGrowth),
      },

      // Breakdowns
      byCurrency,
      topTracks,

      // Chart data
      chartData,

      // Recent activity
      recentTransactions,
    });

  } catch (error) {
    console.error('Revenue analytics error:', error);
    return NextResponse.json({ error: 'Failed to get revenue analytics' }, { status: 500 });
  }
}

// Helper function for date labels
function formatDateLabel(date: string, groupBy: string): string {
  const d = new Date(date);
  
  switch (groupBy) {
    case 'month':
      return d.toLocaleDateString('default', { month: 'short', year: '2-digit' });
    case 'week':
      return `Week of ${d.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
    default:
      return d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  }
}
