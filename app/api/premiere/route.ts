// app/api/premiere/route.ts
// Music video premiere management - schedule, access control, live features

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublicKey } from '@solana/web3.js';

// GET - Fetch upcoming and live premieres
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'upcoming' | 'live' | 'ended'
    const artistId = searchParams.get('artistId');
    
    const now = new Date();
    
    let where: Record<string, unknown> = {};
    
    if (status === 'upcoming') {
      where.premiereAt = { gt: now };
      where.status = 'scheduled';
    } else if (status === 'live') {
      where.status = 'live';
    } else if (status === 'ended') {
      where.status = 'ended';
    }
    
    if (artistId) {
      where.artistId = artistId;
    }
    
    // Note: This assumes a Premiere model exists - we'll add it to schema
    // For now, return mock data structure
    const premieres = [
      {
        id: 'premiere-1',
        title: 'Exclusive Music Video Premiere',
        description: 'Be the first to watch the new visual',
        artist: { id: 'artist-1', name: 'Demo Artist', avatarUrl: null },
        premiereAt: new Date(Date.now() + 3600000).toISOString(),
        status: 'scheduled',
        gateType: 'token',
        gateTokenAmount: 100,
        viewerCount: 0,
        maxViewers: 1000,
        price: { sol: 0.1, token: 50 },
        thumbnail: null,
      }
    ];
    
    return NextResponse.json({ premieres });
  } catch (error) {
    console.error('GET premieres error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new premiere (artist only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      trackId,
      title,
      description,
      premiereAt,
      gateType,
      gateTokenAmount,
      maxViewers,
      price,
    } = body;

    if (!walletAddress || !trackId || !title || !premiereAt) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Validate wallet
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 });
    }

    // Verify user is the artist
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true }
    });

    if (!user?.artist) {
      return NextResponse.json({ error: 'Not an artist' }, { status: 403 });
    }

    // Verify track belongs to artist
    const track = await prisma.track.findUnique({
      where: { id: trackId }
    });

    if (!track || track.artistId !== user.artist.id) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Premiere must be at least 1 hour in the future
    const premiereDate = new Date(premiereAt);
    if (premiereDate.getTime() < Date.now() + 3600000) {
      return NextResponse.json({ 
        error: 'Premiere must be at least 1 hour from now' 
      }, { status: 400 });
    }

    // In production, create premiere record
    // For now, return mock success
    const premiere = {
      id: `premiere-${Date.now()}`,
      trackId,
      title,
      description,
      premiereAt: premiereDate.toISOString(),
      gateType: gateType || 'none',
      gateTokenAmount: gateTokenAmount || 0,
      maxViewers: maxViewers || 0,
      price: price || { sol: 0, token: 0 },
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(premiere, { status: 201 });
  } catch (error) {
    console.error('POST premiere error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
