// app/api/cron/sync-stats/route.ts
// Cron job to sync platform stats (runs hourly on Vercel)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel Cron authentication
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  if (process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's stats
    const [
      totalPlays,
      uniqueListeners,
      newUsers,
      newArtists,
      newTracks,
    ] = await Promise.all([
      prisma.play.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.play.groupBy({
        by: ['userId'],
        where: { 
          createdAt: { gte: today },
          userId: { not: null }
        }
      }).then(r => r.length),
      prisma.user.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.artist.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.track.count({
        where: { createdAt: { gte: today } }
      }),
    ]);

    // Get top tracks today
    const topTracksData = await prisma.play.groupBy({
      by: ['trackId'],
      where: { createdAt: { gte: today } },
      _count: { trackId: true },
      orderBy: { _count: { trackId: 'desc' } },
      take: 10
    });
    const topTracks = topTracksData.map(t => t.trackId);

    // Get top artists today
    const topArtistPlays = await prisma.play.findMany({
      where: { createdAt: { gte: today } },
      select: { track: { select: { artistId: true } } }
    });
    const artistCounts: Record<string, number> = {};
    topArtistPlays.forEach(p => {
      artistCounts[p.track.artistId] = (artistCounts[p.track.artistId] || 0) + 1;
    });
    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    // Upsert daily stats
    await prisma.dailyStats.upsert({
      where: { date: today },
      update: {
        totalPlays,
        uniqueListeners,
        newUsers,
        newArtists,
        newTracks,
        topTracks: JSON.stringify(topTracks),
        topArtists: JSON.stringify(topArtists),
      },
      create: {
        date: today,
        totalPlays,
        uniqueListeners,
        newUsers,
        newArtists,
        newTracks,
        topTracks: JSON.stringify(topTracks),
        topArtists: JSON.stringify(topArtists),
      }
    });

    // Update artist denormalized stats
    const artists = await prisma.artist.findMany({
      select: { id: true }
    });

    for (const artist of artists) {
      const [trackCount, totalPlays, followerCount] = await Promise.all([
        prisma.track.count({ where: { artistId: artist.id } }),
        prisma.play.count({
          where: { track: { artistId: artist.id } }
        }),
        prisma.follow.count({
          where: { 
            following: { artist: { id: artist.id } }
          }
        }),
      ]);

      await prisma.artist.update({
        where: { id: artist.id },
        data: {
          totalTracks: trackCount,
          totalPlays,
          totalFollowers: followerCount,
        }
      });
    }

    return NextResponse.json({
      success: true,
      date: today.toISOString(),
      stats: {
        totalPlays,
        uniqueListeners,
        newUsers,
        newArtists,
        newTracks,
        artistsUpdated: artists.length
      }
    });

  } catch (error) {
    console.error('Cron sync-stats error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
