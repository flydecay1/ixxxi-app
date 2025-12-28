// app/api/analytics/realtime/route.ts
// Real-time metrics API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get real-time metrics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'platform'; // 'platform' | 'artist' | 'track'
  const artistId = searchParams.get('artistId');
  const trackId = searchParams.get('trackId');

  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (type === 'track' && trackId) {
      // Track-specific real-time stats
      const [
        currentListeners,
        hourlyPlays,
        dailyPlays,
        recentLikes,
        recentComments,
      ] = await Promise.all([
        // Active listeners (played in last 5 minutes)
        prisma.play.count({
          where: {
            trackId,
            createdAt: { gte: fiveMinutesAgo },
          },
        }),
        // Plays in last hour
        prisma.play.count({
          where: {
            trackId,
            createdAt: { gte: oneHourAgo },
          },
        }),
        // Plays in last 24 hours
        prisma.play.count({
          where: {
            trackId,
            createdAt: { gte: twentyFourHoursAgo },
          },
        }),
        // Likes in last hour
        prisma.like.count({
          where: {
            trackId,
            createdAt: { gte: oneHourAgo },
          },
        }),
        // Comments in last hour
        prisma.comment.count({
          where: {
            trackId,
            createdAt: { gte: oneHourAgo },
          },
        }),
      ]);

      return NextResponse.json({
        type: 'track',
        trackId,
        timestamp: now,
        realtime: {
          currentListeners,
          playsLastHour: hourlyPlays,
          playsLast24h: dailyPlays,
          likesLastHour: recentLikes,
          commentsLastHour: recentComments,
          velocity: calculateVelocity(hourlyPlays, dailyPlays),
        },
      });
    }

    if (type === 'artist' && artistId) {
      // Artist-specific real-time stats
      const artist = await prisma.artist.findUnique({
        where: { id: artistId },
        select: {
          id: true,
          name: true,
          tracks: {
            select: { id: true },
          },
        },
      });

      if (!artist) {
        return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
      }

      const trackIds = artist.tracks.map(t => t.id);

      const [
        currentListeners,
        hourlyPlays,
        dailyPlays,
        newFollowers,
        recentPurchases,
      ] = await Promise.all([
        prisma.play.count({
          where: {
            trackId: { in: trackIds },
            createdAt: { gte: fiveMinutesAgo },
          },
        }),
        prisma.play.count({
          where: {
            trackId: { in: trackIds },
            createdAt: { gte: oneHourAgo },
          },
        }),
        prisma.play.count({
          where: {
            trackId: { in: trackIds },
            createdAt: { gte: twentyFourHoursAgo },
          },
        }),
        prisma.follow.count({
          where: {
            following: {
              artist: { id: artistId },
            },
            createdAt: { gte: twentyFourHoursAgo },
          },
        }),
        prisma.purchase.count({
          where: {
            trackId: { in: trackIds },
            status: 'COMPLETED',
            createdAt: { gte: twentyFourHoursAgo },
          },
        }),
      ]);

      // Get top performing track right now
      const topTrackPlays = await prisma.play.groupBy({
        by: ['trackId'],
        where: {
          trackId: { in: trackIds },
          createdAt: { gte: oneHourAgo },
        },
        _count: { id: true },
        orderBy: {
          _count: { id: 'desc' },
        },
        take: 1,
      });

      let topTrack = null;
      if (topTrackPlays.length > 0) {
        topTrack = await prisma.track.findUnique({
          where: { id: topTrackPlays[0].trackId },
          select: {
            id: true,
            title: true,
            ticker: true,
            coverUrl: true,
          },
        });
      }

      return NextResponse.json({
        type: 'artist',
        artistId,
        artistName: artist.name,
        timestamp: now,
        realtime: {
          currentListeners,
          playsLastHour: hourlyPlays,
          playsLast24h: dailyPlays,
          newFollowersLast24h: newFollowers,
          salesLast24h: recentPurchases,
          topTrackNow: topTrack ? {
            ...topTrack,
            playsLastHour: topTrackPlays[0]._count.id,
          } : null,
          velocity: calculateVelocity(hourlyPlays, dailyPlays),
        },
      });
    }

    // Platform-wide real-time stats
    const [
      activeListeners,
      hourlyPlays,
      dailyPlays,
      newUsers,
      newTracks,
      recentPurchases,
    ] = await Promise.all([
      prisma.play.count({
        where: {
          createdAt: { gte: fiveMinutesAgo },
        },
      }),
      prisma.play.count({
        where: {
          createdAt: { gte: oneHourAgo },
        },
      }),
      prisma.play.count({
        where: {
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.track.count({
        where: {
          publishedAt: { gte: twentyFourHoursAgo },
          status: 'published',
        },
      }),
      prisma.purchase.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: twentyFourHoursAgo },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Trending tracks (most plays in last hour)
    const trendingTrackIds = await prisma.play.groupBy({
      by: ['trackId'],
      where: {
        createdAt: { gte: oneHourAgo },
      },
      _count: { id: true },
      orderBy: {
        _count: { id: 'desc' },
      },
      take: 5,
    });

    const trendingTracks = await prisma.track.findMany({
      where: {
        id: { in: trendingTrackIds.map(t => t.trackId) },
      },
      select: {
        id: true,
        title: true,
        ticker: true,
        coverUrl: true,
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const trendingWithStats = trendingTracks.map(track => ({
      ...track,
      playsLastHour: trendingTrackIds.find(t => t.trackId === track.id)?._count.id || 0,
    })).sort((a, b) => b.playsLastHour - a.playsLastHour);

    // Top artists right now
    const artistPlays = await prisma.play.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
      },
      select: {
        track: {
          select: {
            artistId: true,
          },
        },
      },
    });

    const artistPlayCounts = new Map<string, number>();
    for (const play of artistPlays) {
      const artistId = play.track.artistId;
      artistPlayCounts.set(artistId, (artistPlayCounts.get(artistId) || 0) + 1);
    }

    const topArtistIds = Array.from(artistPlayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topArtists = await prisma.artist.findMany({
      where: {
        id: { in: topArtistIds.map(([id]) => id) },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isVerified: true,
      },
    });

    const topArtistsWithStats = topArtists.map(artist => ({
      ...artist,
      playsLastHour: artistPlayCounts.get(artist.id) || 0,
    })).sort((a, b) => b.playsLastHour - a.playsLastHour);

    return NextResponse.json({
      type: 'platform',
      timestamp: now,
      realtime: {
        activeListeners,
        playsLastHour: hourlyPlays,
        playsLast24h: dailyPlays,
        newUsersLast24h: newUsers,
        newTracksLast24h: newTracks,
        salesLast24h: {
          count: recentPurchases._count.id,
          volume: recentPurchases._sum.amount || 0,
        },
        playsPerMinute: Math.round(hourlyPlays / 60),
        velocity: calculateVelocity(hourlyPlays, dailyPlays),
      },
      trending: {
        tracks: trendingWithStats,
        artists: topArtistsWithStats,
      },
    });

  } catch (error) {
    console.error('Realtime analytics error:', error);
    return NextResponse.json({ error: 'Failed to get realtime metrics' }, { status: 500 });
  }
}

// Calculate velocity (hourly rate vs daily average)
function calculateVelocity(hourlyPlays: number, dailyPlays: number): {
  status: 'surging' | 'rising' | 'stable' | 'declining';
  percentage: number;
} {
  const hourlyAverage = dailyPlays / 24;
  
  if (hourlyAverage === 0) {
    return { status: 'stable', percentage: 0 };
  }

  const ratio = hourlyPlays / hourlyAverage;
  const percentage = Math.round((ratio - 1) * 100);

  if (ratio >= 2) {
    return { status: 'surging', percentage };
  } else if (ratio >= 1.25) {
    return { status: 'rising', percentage };
  } else if (ratio >= 0.75) {
    return { status: 'stable', percentage };
  } else {
    return { status: 'declining', percentage };
  }
}
