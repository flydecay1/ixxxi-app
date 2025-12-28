// app/api/analytics/audience/route.ts
// Audience insights and demographics

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get audience insights
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artistId');
  const walletAddress = searchParams.get('wallet');
  const period = searchParams.get('period') || '30d';

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

    // Get artist if wallet provided
    let targetArtistId = artistId;
    if (walletAddress && !artistId) {
      const artist = await prisma.artist.findFirst({
        where: { wallet: walletAddress },
      });
      if (artist) {
        targetArtistId = artist.id;
      }
    }

    // Build track filter
    let trackIds: string[] = [];
    if (targetArtistId) {
      const tracks = await prisma.track.findMany({
        where: { artistId: targetArtistId },
        select: { id: true },
      });
      trackIds = tracks.map(t => t.id);
    }

    // Get all plays with user data
    const plays = await prisma.play.findMany({
      where: {
        createdAt: { gte: startDate },
        ...(trackIds.length > 0 ? { trackId: { in: trackIds } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            tier: true,
            tokenBalance: true,
            createdAt: true,
          },
        },
        track: {
          select: {
            id: true,
            genre: true,
          },
        },
      },
    });

    // Unique listeners
    const uniqueListenerIds = new Set(plays.filter(p => p.userId).map(p => p.userId));
    const totalListeners = uniqueListenerIds.size;

    // Get detailed user data for engaged listeners
    const engagedUsers = await prisma.user.findMany({
      where: {
        id: { in: Array.from(uniqueListenerIds).filter(Boolean) as string[] },
      },
      select: {
        id: true,
        tier: true,
        tokenBalance: true,
        createdAt: true,
        totalPlays: true,
      },
    });

    // Tier breakdown
    const tierBreakdown = {
      whale: { count: 0, plays: 0, avgPlays: 0 },
      premium: { count: 0, plays: 0, avgPlays: 0 },
      holder: { count: 0, plays: 0, avgPlays: 0 },
      free: { count: 0, plays: 0, avgPlays: 0 },
    };

    const userPlayCounts = new Map<string, { tier: string; plays: number }>();
    
    for (const play of plays) {
      const userId = play.userId || 'anonymous';
      const tier = play.user?.tier || 'free';
      
      if (!userPlayCounts.has(userId)) {
        userPlayCounts.set(userId, { tier, plays: 0 });
      }
      userPlayCounts.get(userId)!.plays++;
    }

    for (const [userId, data] of userPlayCounts) {
      if (userId !== 'anonymous') {
        const tier = data.tier as keyof typeof tierBreakdown;
        tierBreakdown[tier].count++;
        tierBreakdown[tier].plays += data.plays;
      }
    }

    // Calculate averages
    for (const tier of Object.keys(tierBreakdown) as Array<keyof typeof tierBreakdown>) {
      if (tierBreakdown[tier].count > 0) {
        tierBreakdown[tier].avgPlays = Math.round(
          tierBreakdown[tier].plays / tierBreakdown[tier].count
        );
      }
    }

    // Engagement levels
    const playCountGroups = {
      superFans: 0,    // 50+ plays
      regular: 0,      // 10-49 plays
      casual: 0,       // 3-9 plays  
      oneTime: 0,      // 1-2 plays
    };

    for (const [_, data] of userPlayCounts) {
      if (data.plays >= 50) playCountGroups.superFans++;
      else if (data.plays >= 10) playCountGroups.regular++;
      else if (data.plays >= 3) playCountGroups.casual++;
      else playCountGroups.oneTime++;
    }

    // Listening patterns - time of day
    const hourlyDistribution = new Array(24).fill(0);
    for (const play of plays) {
      hourlyDistribution[play.createdAt.getHours()]++;
    }

    const peakListeningHours = hourlyDistribution
      .map((plays, hour) => ({ hour, plays }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5)
      .map(h => ({
        hour: h.hour,
        label: `${h.hour % 12 || 12}:00 ${h.hour >= 12 ? 'PM' : 'AM'}`,
        plays: h.plays,
        percentage: plays.length > 0 ? Math.round((h.plays / plays.length) * 100) : 0,
      }));

    // Day of week distribution
    const dayDistribution = new Array(7).fill(0);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (const play of plays) {
      dayDistribution[play.createdAt.getDay()]++;
    }

    const dayOfWeekStats = dayDistribution.map((plays, day) => ({
      day: dayNames[day],
      shortDay: dayNames[day].substring(0, 3),
      plays,
      percentage: plays.length > 0 ? Math.round((plays / plays.length) * 100) : 0,
    }));

    // Genre preferences (for listeners)
    const genrePreferences = new Map<string, number>();
    for (const play of plays) {
      if (play.track.genre) {
        genrePreferences.set(play.track.genre, (genrePreferences.get(play.track.genre) || 0) + 1);
      }
    }

    const topGenres = Array.from(genrePreferences.entries())
      .map(([genre, plays]) => ({
        genre,
        plays,
        percentage: plays.length > 0 ? Math.round((plays / plays.length) * 100) : 0,
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);

    // New vs returning listeners
    const newListeners = engagedUsers.filter(u => 
      u.createdAt >= startDate
    ).length;
    const returningListeners = totalListeners - newListeners;

    // Listener retention (users who listened multiple times)
    const retainedListeners = Array.from(userPlayCounts.values())
      .filter(u => u.plays > 1).length;
    const retentionRate = totalListeners > 0 
      ? (retainedListeners / totalListeners) * 100 
      : 0;

    // Token holder breakdown
    const tokenHolders = engagedUsers.filter(u => u.tokenBalance > 0);
    const avgTokenBalance = tokenHolders.length > 0
      ? tokenHolders.reduce((sum, u) => sum + u.tokenBalance, 0) / tokenHolders.length
      : 0;

    // Growth metrics
    const listenersPerDay = new Map<string, Set<string>>();
    for (const play of plays) {
      const dateStr = play.createdAt.toISOString().split('T')[0];
      if (!listenersPerDay.has(dateStr)) {
        listenersPerDay.set(dateStr, new Set());
      }
      if (play.userId) {
        listenersPerDay.get(dateStr)!.add(play.userId);
      }
    }

    const dailyActiveListeners = Array.from(listenersPerDay.entries())
      .map(([date, listeners]) => ({
        date,
        count: listeners.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate 7-day rolling average
    const avgDailyListeners = dailyActiveListeners.length > 0
      ? Math.round(
          dailyActiveListeners.reduce((sum, d) => sum + d.count, 0) / dailyActiveListeners.length
        )
      : 0;

    return NextResponse.json({
      period,
      dateRange: {
        start: startDate,
        end: now,
      },

      // Overview
      overview: {
        totalListeners,
        newListeners,
        returningListeners,
        retentionRate: Math.round(retentionRate),
        avgDailyListeners,
      },

      // Demographics
      demographics: {
        tierBreakdown,
        tierPercentages: {
          whale: totalListeners > 0 ? Math.round((tierBreakdown.whale.count / totalListeners) * 100) : 0,
          premium: totalListeners > 0 ? Math.round((tierBreakdown.premium.count / totalListeners) * 100) : 0,
          holder: totalListeners > 0 ? Math.round((tierBreakdown.holder.count / totalListeners) * 100) : 0,
          free: totalListeners > 0 ? Math.round((tierBreakdown.free.count / totalListeners) * 100) : 0,
        },
        tokenHolderCount: tokenHolders.length,
        avgTokenBalance: Math.round(avgTokenBalance),
      },

      // Engagement
      engagement: {
        playCountGroups,
        engagementBreakdown: {
          superFans: totalListeners > 0 ? Math.round((playCountGroups.superFans / totalListeners) * 100) : 0,
          regular: totalListeners > 0 ? Math.round((playCountGroups.regular / totalListeners) * 100) : 0,
          casual: totalListeners > 0 ? Math.round((playCountGroups.casual / totalListeners) * 100) : 0,
          oneTime: totalListeners > 0 ? Math.round((playCountGroups.oneTime / totalListeners) * 100) : 0,
        },
      },

      // Listening patterns
      listeningPatterns: {
        peakListeningHours,
        dayOfWeekStats,
        topGenres,
      },

      // Chart data
      dailyActiveListeners: dailyActiveListeners.slice(-30), // Last 30 days
    });

  } catch (error) {
    console.error('Audience insights error:', error);
    return NextResponse.json({ error: 'Failed to get audience insights' }, { status: 500 });
  }
}
