// app/api/track/route.ts
// Track management API - create, read, update, delete tracks

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublicKey } from '@solana/web3.js';

// GET - Fetch tracks with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('artistId');
    const genre = searchParams.get('genre');
    const gateType = searchParams.get('gateType');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (artistId) where.artistId = artistId;
    if (genre) where.genre = genre;
    if (gateType) where.gateType = gateType;

    const tracks = await prisma.track.findMany({
      where,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
          }
        },
        _count: {
          select: { plays: true, likes: true }
        }
      },
      orderBy: { [sortBy]: order },
      take: limit,
      skip: offset,
    });

    const total = await prisma.track.count({ where });

    return NextResponse.json({
      tracks,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + tracks.length < total,
      }
    });
  } catch (error) {
    console.error('GET tracks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new track (artist only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      title,
      ticker,
      description,
      genre,
      bpm,
      audioUrl,
      coverUrl,
      waveformData,
      region,
      coordinates,
      duration,
      gateType,
      gateTokenMint,
      gateTokenAmount,
      gateNftCollection,
      priceSOL,
      priceToken,
      status,
    } = body;

    if (!walletAddress || !title || !ticker || !audioUrl) {
      return NextResponse.json({ 
        error: 'Missing required fields: walletAddress, title, ticker, audioUrl' 
      }, { status: 400 });
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Verify user is an artist
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.artist) {
      return NextResponse.json({ error: 'Not an artist account' }, { status: 403 });
    }

    // Validate gate configuration
    if (gateType && gateType !== 'none') {
      if (!gateTokenMint && !gateNftCollection) {
        return NextResponse.json({ error: 'Gate token mint or NFT collection required' }, { status: 400 });
      }
      if (gateTokenMint) {
        try {
          new PublicKey(gateTokenMint);
        } catch {
          return NextResponse.json({ error: 'Invalid gate token mint address' }, { status: 400 });
        }
      }
    }

    // Create track
    const track = await prisma.track.create({
      data: {
        title,
        ticker,
        description,
        genre,
        bpm,
        audioUrl,
        coverUrl,
        waveformData,
        region,
        coordinates,
        duration,
        gateType: gateType || 'none',
        gateTokenMint,
        gateTokenAmount,
        gateNftCollection,
        priceSOL,
        priceToken,
        status: status || 'draft',
        artistId: user.artist.id,
      },
      include: {
        artist: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    return NextResponse.json(track, { status: 201 });
  } catch (error) {
    console.error('POST track error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a track (owner only)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, trackId, ...updates } = body;

    if (!walletAddress || !trackId) {
      return NextResponse.json({ error: 'walletAddress and trackId required' }, { status: 400 });
    }

    // Verify ownership
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true }
    });

    if (!user?.artist) {
      return NextResponse.json({ error: 'Not an artist account' }, { status: 403 });
    }

    const track = await prisma.track.findUnique({
      where: { id: trackId }
    });

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.artistId !== user.artist.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Filter allowed updates
    const allowedFields = [
      'title', 'ticker', 'description', 'genre', 'bpm', 'coverUrl', 'waveformData',
      'region', 'coordinates', 'gateType', 'gateTokenMint', 'gateTokenAmount',
      'gateNftCollection', 'priceSOL', 'priceToken', 'status'
    ];
    const filteredUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    const updatedTrack = await prisma.track.update({
      where: { id: trackId },
      data: filteredUpdates,
      include: {
        artist: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    return NextResponse.json(updatedTrack);
  } catch (error) {
    console.error('PATCH track error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a track (owner only)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress || !trackId) {
      return NextResponse.json({ error: 'walletAddress and trackId required' }, { status: 400 });
    }

    // Verify ownership
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true }
    });

    if (!user?.artist) {
      return NextResponse.json({ error: 'Not an artist account' }, { status: 403 });
    }

    const track = await prisma.track.findUnique({
      where: { id: trackId }
    });

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.artistId !== user.artist.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await prisma.track.delete({
      where: { id: trackId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE track error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
