// app/api/radio/route.ts
// Radio mode - auto-generate playlist based on seed

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Generate radio playlist
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const seedType = searchParams.get('type') || 'track'; // 'track' | 'artist' | 'genre' | 'mood'
  const seedId = searchParams.get('seedId');
  const genre = searchParams.get('genre');
  const mood = searchParams.get('mood'); // 'energetic' | 'chill' | 'focus' | 'party'
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50);
  const excludeIds = searchParams.get('exclude')?.split(',') || [];

  try {
    let seedTrack: any = null;
    let seedArtist: any = null;
    let targetGenre: string | null = genre || null;
    let targetBpmRange: { min: number; max: number } | null = null;

    // Get seed data
    if (seedType === 'track' && seedId) {
      seedTrack = await prisma.track.findUnique({
        where: { id: seedId },
        select: {
          id: true,
          genre: true,
          bpm: true,
          artistId: true,
          artist: {
            select: { name: true },
          },
        },
      });

      if (seedTrack) {
        targetGenre = seedTrack.genre;
        if (seedTrack.bpm) {
          targetBpmRange = {
            min: seedTrack.bpm - 20,
            max: seedTrack.bpm + 20,
          };
        }
      }
    } else if (seedType === 'artist' && seedId) {
      seedArtist = await prisma.artist.findUnique({
        where: { id: seedId },
        select: {
          id: true,
          genre: true,
          name: true,
        },
      });

      if (seedArtist?.genre) {
        targetGenre = seedArtist.genre;
      }
    }

    // Mood to BPM mapping
    if (mood) {
      switch (mood) {
        case 'energetic':
          targetBpmRange = { min: 120, max: 180 };
          break;
        case 'chill':
          targetBpmRange = { min: 60, max: 100 };
          break;
        case 'focus':
          targetBpmRange = { min: 90, max: 130 };
          break;
        case 'party':
          targetBpmRange = { min: 115, max: 140 };
          break;
      }
    }

    // Build query
    const where: any = {
      status: 'published',
      id: { notIn: [...excludeIds, seedId].filter(Boolean) as string[] },
    };

    if (targetGenre) {
      where.genre = targetGenre;
    }

    if (targetBpmRange) {
      where.bpm = {
        gte: targetBpmRange.min,
        lte: targetBpmRange.max,
      };
    }

    // Get matching tracks
    let tracks = await prisma.track.findMany({
      where,
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
      take: limit * 2, // Get extra for shuffling
    });

    // If not enough tracks, relax genre constraint
    if (tracks.length < limit / 2) {
      const additionalTracks = await prisma.track.findMany({
        where: {
          status: 'published',
          id: { notIn: [...excludeIds, seedId, ...tracks.map(t => t.id)].filter(Boolean) as string[] },
          ...(targetBpmRange ? { bpm: { gte: targetBpmRange.min, lte: targetBpmRange.max } } : {}),
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
        take: limit - tracks.length,
      });

      tracks = [...tracks, ...additionalTracks];
    }

    // Shuffle tracks for variety
    const shuffled = tracks
      .map(t => ({ track: t, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(t => t.track)
      .slice(0, limit);

    // Format response
    const radioTracks = shuffled.map((t, index) => ({
      position: index + 1,
      id: t.id,
      title: t.title,
      ticker: t.ticker,
      coverUrl: t.coverUrl,
      duration: t.duration,
      genre: t.genre,
      bpm: t.bpm,
      artist: t.artist,
    }));

    // Calculate total duration
    const totalDuration = radioTracks.reduce((sum, t) => sum + (t.duration || 0), 0);

    return NextResponse.json({
      radio: {
        seed: {
          type: seedType,
          id: seedId || null,
          genre: targetGenre,
          mood: mood || null,
          name: seedTrack?.artist?.name || seedArtist?.name || targetGenre || mood || 'Mixed',
        },
        tracks: radioTracks,
        stats: {
          trackCount: radioTracks.length,
          totalDuration,
          formattedDuration: formatDuration(totalDuration),
          genres: [...new Set(radioTracks.map(t => t.genre).filter(Boolean))],
        },
      },
    });

  } catch (error) {
    console.error('Radio error:', error);
    return NextResponse.json({ error: 'Failed to generate radio' }, { status: 500 });
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}
