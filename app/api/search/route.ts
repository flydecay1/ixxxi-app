// app/api/search/route.ts
// Full-text search API for tracks, artists, playlists

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const type = searchParams.get('type') || 'all'; // 'all' | 'tracks' | 'artists' | 'playlists' | 'users'
  const genre = searchParams.get('genre');
  const sortBy = searchParams.get('sort') || 'relevance'; // 'relevance' | 'recent' | 'popular'
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!query || query.length < 2) {
    return NextResponse.json({ 
      error: 'Search query must be at least 2 characters' 
    }, { status: 400 });
  }

  try {
    const results: {
      tracks: any[];
      artists: any[];
      playlists: any[];
      users: any[];
      total: number;
    } = {
      tracks: [],
      artists: [],
      playlists: [],
      users: [],
      total: 0,
    };

    // Build search conditions
    const searchCondition = {
      contains: query,
      mode: 'insensitive' as const,
    };

    // Search tracks
    if (type === 'all' || type === 'tracks') {
      const trackWhere: any = {
        status: 'published',
        OR: [
          { title: searchCondition },
          { ticker: searchCondition },
          { description: searchCondition },
          { artist: { name: searchCondition } },
        ],
      };

      if (genre) {
        trackWhere.genre = genre;
      }

      const trackOrderBy: any = 
        sortBy === 'recent' ? { publishedAt: 'desc' } :
        sortBy === 'popular' ? { playCount: 'desc' } :
        { playCount: 'desc' }; // Default to popular for relevance

      const [tracks, trackCount] = await Promise.all([
        prisma.track.findMany({
          where: trackWhere,
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
          orderBy: trackOrderBy,
          take: type === 'tracks' ? limit : Math.ceil(limit / 3),
          skip: type === 'tracks' ? offset : 0,
        }),
        prisma.track.count({ where: trackWhere }),
      ]);

      results.tracks = tracks.map(t => ({
        id: t.id,
        title: t.title,
        ticker: t.ticker,
        coverUrl: t.coverUrl,
        duration: t.duration,
        genre: t.genre,
        playCount: t.playCount,
        likeCount: t.likeCount,
        artist: t.artist,
        type: 'track',
      }));
      results.total += trackCount;
    }

    // Search artists
    if (type === 'all' || type === 'artists') {
      const artistWhere = {
        OR: [
          { name: searchCondition },
          { bio: searchCondition },
        ],
      };

      const artistOrderBy: any =
        sortBy === 'recent' ? { createdAt: 'desc' } :
        sortBy === 'popular' ? { totalPlays: 'desc' } :
        { totalFollowers: 'desc' };

      const [artists, artistCount] = await Promise.all([
        prisma.artist.findMany({
          where: artistWhere,
          orderBy: artistOrderBy,
          take: type === 'artists' ? limit : Math.ceil(limit / 4),
          skip: type === 'artists' ? offset : 0,
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            bio: true,
            genre: true,
            isVerified: true,
            totalTracks: true,
            totalPlays: true,
            totalFollowers: true,
          },
        }),
        prisma.artist.count({ where: artistWhere }),
      ]);

      results.artists = artists.map(a => ({
        ...a,
        type: 'artist',
      }));
      results.total += artistCount;
    }

    // Search playlists
    if (type === 'all' || type === 'playlists') {
      const playlistWhere = {
        isPublic: true,
        OR: [
          { name: searchCondition },
          { description: searchCondition },
        ],
      };

      const [playlists, playlistCount] = await Promise.all([
        prisma.playlist.findMany({
          where: playlistWhere,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
            _count: {
              select: { tracks: true },
            },
          },
          orderBy: sortBy === 'recent' ? { createdAt: 'desc' } : { updatedAt: 'desc' },
          take: type === 'playlists' ? limit : Math.ceil(limit / 4),
          skip: type === 'playlists' ? offset : 0,
        }),
        prisma.playlist.count({ where: playlistWhere }),
      ]);

      results.playlists = playlists.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        coverUrl: p.coverUrl,
        trackCount: p._count.tracks,
        user: p.user,
        type: 'playlist',
      }));
      results.total += playlistCount;
    }

    // Search users
    if (type === 'all' || type === 'users') {
      const userWhere = {
        OR: [
          { username: searchCondition },
        ],
        // Exclude users without usernames
        username: { not: null },
      };

      const [users, userCount] = await Promise.all([
        prisma.user.findMany({
          where: userWhere,
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            tier: true,
            artist: {
              select: {
                id: true,
                isVerified: true,
              },
            },
          },
          take: type === 'users' ? limit : Math.ceil(limit / 4),
          skip: type === 'users' ? offset : 0,
        }),
        prisma.user.count({ where: userWhere }),
      ]);

      results.users = users.map(u => ({
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        tier: u.tier,
        isArtist: !!u.artist,
        isVerified: u.artist?.isVerified || false,
        type: 'user',
      }));
      results.total += userCount;
    }

    return NextResponse.json({
      query,
      type,
      results,
      pagination: {
        limit,
        offset,
        total: results.total,
        hasMore: offset + limit < results.total,
      },
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
