// app/api/genres/route.ts
// Genre browsing API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Predefined genre list with metadata
const GENRE_METADATA: Record<string, { color: string; icon: string }> = {
  'Electronic': { color: '#00FFFF', icon: '⚡' },
  'Hip Hop': { color: '#FF6B6B', icon: '🎤' },
  'R&B': { color: '#9B59B6', icon: '💜' },
  'Pop': { color: '#FF69B4', icon: '🎵' },
  'Rock': { color: '#E74C3C', icon: '🎸' },
  'Jazz': { color: '#F39C12', icon: '🎷' },
  'Classical': { color: '#8B4513', icon: '🎻' },
  'Lo-Fi': { color: '#95A5A6', icon: '☕' },
  'House': { color: '#1ABC9C', icon: '🏠' },
  'Techno': { color: '#2ECC71', icon: '🔊' },
  'Ambient': { color: '#3498DB', icon: '🌙' },
  'Indie': { color: '#E67E22', icon: '🎹' },
  'Soul': { color: '#D35400', icon: '❤️' },
  'Reggae': { color: '#27AE60', icon: '🌴' },
  'Country': { color: '#CD853F', icon: '🤠' },
  'Metal': { color: '#2C3E50', icon: '🤘' },
  'Punk': { color: '#C0392B', icon: '⛓️' },
  'Folk': { color: '#8B7355', icon: '🪕' },
  'Latin': { color: '#FF4500', icon: '💃' },
  'World': { color: '#20B2AA', icon: '🌍' },
};

// GET - List all genres with stats
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get('featured') === 'true';
  const withStats = searchParams.get('stats') !== 'false';

  try {
    // Get genre stats from database
    const genreStats = await prisma.track.groupBy({
      by: ['genre'],
      where: {
        status: 'published',
        genre: { not: null },
      },
      _count: { id: true },
      _sum: { playCount: true },
    });

    // Build genre list with metadata
    const genres = genreStats
      .filter(g => g.genre)
      .map(g => ({
        name: g.genre!,
        trackCount: g._count.id,
        totalPlays: g._sum.playCount || 0,
        ...GENRE_METADATA[g.genre!] || { color: '#666666', icon: '🎵' },
      }))
      .sort((a, b) => b.totalPlays - a.totalPlays);

    // Get featured genres (top 6 by plays)
    const featuredGenres = genres.slice(0, 6);

    if (featured) {
      return NextResponse.json({ genres: featuredGenres });
    }

    // Get trending tracks per genre if stats requested
    let genreHighlights: Record<string, any[]> = {};
    
    if (withStats) {
      const topGenres = genres.slice(0, 10);
      
      for (const genre of topGenres) {
        const topTracks = await prisma.track.findMany({
          where: {
            genre: genre.name,
            status: 'published',
          },
          select: {
            id: true,
            title: true,
            ticker: true,
            coverUrl: true,
            playCount: true,
            artist: {
              select: {
                name: true,
                isVerified: true,
              },
            },
          },
          orderBy: { playCount: 'desc' },
          take: 3,
        });
        
        genreHighlights[genre.name] = topTracks;
      }
    }

    return NextResponse.json({
      genres,
      featured: featuredGenres,
      highlights: genreHighlights,
      total: genres.length,
    });

  } catch (error) {
    console.error('Genres error:', error);
    return NextResponse.json({ error: 'Failed to get genres' }, { status: 500 });
  }
}
