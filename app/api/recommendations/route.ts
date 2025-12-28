// app/api/recommendations/route.ts
// Personalized track recommendations based on listening history

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get personalized recommendations
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const type = searchParams.get('type') || 'mixed'; // 'mixed' | 'similar' | 'trending' | 'new' | 'genre'
  const genre = searchParams.get('genre');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const excludeIds = searchParams.get('exclude')?.split(',') || [];

  try {
    let recommendations: Array<{
      id: string;
      title: string;
      ticker: string;
      coverUrl: string | null;
      duration: number | null;
      playCount: number;
      likeCount: number;
      artist: {
        id: string;
        name: string;
        avatarUrl: string | null;
        isVerified: boolean;
      };
      reason?: string;
      score?: number;
    }> = [];

    // Get user's listening data for personalization
    let userGenres: string[] = [];
    let userArtists: string[] = [];
    let recentTrackIds: string[] = [];

    if (userId) {
      // Get user's most played genres
      const recentPlays = await prisma.play.findMany({
        where: { userId },
        include: {
          track: {
            select: {
              id: true,
              genre: true,
              artistId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      recentTrackIds = recentPlays.map(p => p.trackId);
      
      // Count genres and artists
      const genreCounts = new Map<string, number>();
      const artistCounts = new Map<string, number>();

      for (const play of recentPlays) {
        if (play.track.genre) {
          genreCounts.set(play.track.genre, (genreCounts.get(play.track.genre) || 0) + 1);
        }
        artistCounts.set(play.track.artistId, (artistCounts.get(play.track.artistId) || 0) + 1);
      }

      // Get top genres and artists
      userGenres = Array.from(genreCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([g]) => g);

      userArtists = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([a]) => a);
    }

    // Exclude recently played and specified tracks
    const excludeTrackIds = [...excludeIds, ...recentTrackIds.slice(0, 20)];

    // Build recommendations based on type
    switch (type) {
      case 'similar':
        // Tracks similar to user's favorites (same genres/artists)
        if (userGenres.length > 0 || userArtists.length > 0) {
          const similar = await prisma.track.findMany({
            where: {
              status: 'published',
              id: { notIn: excludeTrackIds },
              OR: [
                { genre: { in: userGenres } },
                { artistId: { in: userArtists } },
              ],
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
            orderBy: [
              { playCount: 'desc' },
              { likeCount: 'desc' },
            ],
            take: limit,
          });

          recommendations = similar.map(t => ({
            id: t.id,
            title: t.title,
            ticker: t.ticker,
            coverUrl: t.coverUrl,
            duration: t.duration,
            playCount: t.playCount,
            likeCount: t.likeCount,
            artist: t.artist,
            reason: t.artistId && userArtists.includes(t.artistId) 
              ? 'From an artist you like'
              : `Based on your ${t.genre} listens`,
          }));
        }
        break;

      case 'trending':
        // Trending tracks (most plays in last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const trending = await prisma.track.findMany({
          where: {
            status: 'published',
            id: { notIn: excludeTrackIds },
            plays: {
              some: {
                createdAt: { gte: weekAgo },
              },
            },
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
            _count: {
              select: {
                plays: {
                  where: { createdAt: { gte: weekAgo } },
                },
              },
            },
          },
          orderBy: {
            playCount: 'desc',
          },
          take: limit,
        });

        recommendations = trending.map(t => ({
          id: t.id,
          title: t.title,
          ticker: t.ticker,
          coverUrl: t.coverUrl,
          duration: t.duration,
          playCount: t.playCount,
          likeCount: t.likeCount,
          artist: t.artist,
          reason: 'Trending this week',
          score: t._count.plays,
        }));
        break;

      case 'new':
        // New releases
        const newTracks = await prisma.track.findMany({
          where: {
            status: 'published',
            id: { notIn: excludeTrackIds },
            publishedAt: { not: null },
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
          orderBy: { publishedAt: 'desc' },
          take: limit,
        });

        recommendations = newTracks.map(t => ({
          id: t.id,
          title: t.title,
          ticker: t.ticker,
          coverUrl: t.coverUrl,
          duration: t.duration,
          playCount: t.playCount,
          likeCount: t.likeCount,
          artist: t.artist,
          reason: 'New release',
        }));
        break;

      case 'genre':
        // Genre-specific recommendations
        if (genre) {
          const genreTracks = await prisma.track.findMany({
            where: {
              status: 'published',
              id: { notIn: excludeTrackIds },
              genre,
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
            orderBy: [
              { playCount: 'desc' },
              { likeCount: 'desc' },
            ],
            take: limit,
          });

          recommendations = genreTracks.map(t => ({
            id: t.id,
            title: t.title,
            ticker: t.ticker,
            coverUrl: t.coverUrl,
            duration: t.duration,
            playCount: t.playCount,
            likeCount: t.likeCount,
            artist: t.artist,
            reason: `Top ${genre} tracks`,
          }));
        }
        break;

      default:
        // Mixed recommendations (combination of all)
        const [similarTracks, trendingTracks, newReleaseTracks] = await Promise.all([
          // Similar to taste
          userGenres.length > 0 ? prisma.track.findMany({
            where: {
              status: 'published',
              id: { notIn: excludeTrackIds },
              genre: { in: userGenres },
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
            orderBy: { playCount: 'desc' },
            take: Math.ceil(limit / 3),
          }) : [],

          // Trending
          prisma.track.findMany({
            where: {
              status: 'published',
              id: { notIn: excludeTrackIds },
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
            orderBy: { playCount: 'desc' },
            take: Math.ceil(limit / 3),
          }),

          // New
          prisma.track.findMany({
            where: {
              status: 'published',
              id: { notIn: excludeTrackIds },
              publishedAt: { not: null },
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
            orderBy: { publishedAt: 'desc' },
            take: Math.ceil(limit / 3),
          }),
        ]);

        // Merge and dedupe
        const seen = new Set<string>();
        const mixed = [];

        for (const track of [...similarTracks, ...trendingTracks, ...newReleaseTracks]) {
          if (!seen.has(track.id)) {
            seen.add(track.id);
            mixed.push({
              id: track.id,
              title: track.title,
              ticker: track.ticker,
              coverUrl: track.coverUrl,
              duration: track.duration,
              playCount: track.playCount,
              likeCount: track.likeCount,
              artist: track.artist,
              reason: similarTracks.some(t => t.id === track.id)
                ? 'Based on your taste'
                : trendingTracks.some(t => t.id === track.id)
                  ? 'Trending'
                  : 'New release',
            });
          }
        }

        recommendations = mixed.slice(0, limit);
    }

    return NextResponse.json({
      recommendations,
      type,
      personalized: !!userId && userGenres.length > 0,
      userPreferences: userId ? {
        topGenres: userGenres.slice(0, 3),
        totalPlays: recentTrackIds.length,
      } : null,
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 });
  }
}
