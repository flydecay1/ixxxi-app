// app/api/tracks/route.ts
// Public tracks API - list and search tracks

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: List published tracks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const genre = searchParams.get('genre');
    const artistId = searchParams.get('artistId');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'recent'; // recent, popular, trending
    
    // Build where clause
    const where: any = {
      status: 'published',
    };
    
    if (genre) {
      where.genre = genre;
    }
    
    if (artistId) {
      where.artistId = artistId;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { ticker: { contains: search, mode: 'insensitive' } },
        { artist: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    
    // Build order clause
    let orderBy: any = { createdAt: 'desc' };
    switch (sort) {
      case 'popular':
        orderBy = { playCount: 'desc' };
        break;
      case 'trending':
        // Trending = most plays in last 7 days (simplified to just play count for now)
        orderBy = [{ playCount: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'recent':
      default:
        orderBy = { publishedAt: 'desc' };
    }
    
    // Get tracks with artist info
    const tracks = await prisma.track.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        ticker: true,
        description: true,
        genre: true,
        duration: true,
        coverUrl: true,
        region: true,
        latitude: true,
        longitude: true,
        gateType: true,
        gateTokenMint: true,
        gateTokenAmount: true,
        priceSOL: true,
        playCount: true,
        likeCount: true,
        publishedAt: true,
        artist: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
    });
    
    // Get total count
    const total = await prisma.track.count({ where });
    
    return NextResponse.json({
      tracks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    
  } catch (error) {
    console.error('Tracks API error:', error);
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
  }
}
