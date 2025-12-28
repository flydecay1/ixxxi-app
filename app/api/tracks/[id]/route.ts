// app/api/tracks/[id]/route.ts
// Single track API - get, update, delete

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Get single track details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const track = await prisma.track.findUnique({
      where: { id: params.id },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
            user: {
              select: {
                walletAddress: true,
              },
            },
          },
        },
      },
    });
    
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    
    // Don't expose internal URLs for non-published tracks
    if (track.status !== 'published') {
      const { audioUrl, audioKey, ...safeTrack } = track;
      return NextResponse.json({ track: safeTrack });
    }
    
    return NextResponse.json({ track });
    
  } catch (error) {
    console.error('Track fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch track' }, { status: 500 });
  }
}

// PATCH: Update track (artist only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { walletAddress, ...updates } = body;
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    }
    
    // Get user and verify ownership
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true },
    });
    
    if (!user?.artist) {
      return NextResponse.json({ error: 'Not an artist' }, { status: 403 });
    }
    
    const track = await prisma.track.findUnique({
      where: { id: params.id },
    });
    
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    
    if (track.artistId !== user.artist.id) {
      return NextResponse.json({ error: 'Not your track' }, { status: 403 });
    }
    
    // Allowed update fields
    const allowedFields = [
      'title', 'ticker', 'description', 'genre', 'region',
      'latitude', 'longitude', 'gateType', 'gateTokenMint',
      'gateTokenAmount', 'priceSOL', 'priceToken', 'status',
    ];
    
    const safeUpdates: any = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    }
    
    // Handle publishing
    if (safeUpdates.status === 'published' && track.status !== 'published') {
      safeUpdates.publishedAt = new Date();
    }
    
    const updatedTrack = await prisma.track.update({
      where: { id: params.id },
      data: safeUpdates,
    });
    
    return NextResponse.json({ track: updatedTrack });
    
  } catch (error) {
    console.error('Track update error:', error);
    return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
  }
}

// DELETE: Delete track (artist only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    }
    
    // Get user and verify ownership
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true },
    });
    
    if (!user?.artist) {
      return NextResponse.json({ error: 'Not an artist' }, { status: 403 });
    }
    
    const track = await prisma.track.findUnique({
      where: { id: params.id },
    });
    
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    
    if (track.artistId !== user.artist.id) {
      return NextResponse.json({ error: 'Not your track' }, { status: 403 });
    }
    
    // Delete from storage if configured
    if (track.audioKey) {
      try {
        const { deleteFile, isStorageConfigured } = await import('@/lib/storage');
        if (isStorageConfigured()) {
          await deleteFile(track.audioKey);
          if (track.coverKey) {
            await deleteFile(track.coverKey);
          }
        }
      } catch (e) {
        console.error('Failed to delete files:', e);
      }
    }
    
    // Delete track record
    await prisma.track.delete({
      where: { id: params.id },
    });
    
    // Update artist track count
    await prisma.artist.update({
      where: { id: user.artist.id },
      data: { totalTracks: { decrement: 1 } },
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Track delete error:', error);
    return NextResponse.json({ error: 'Failed to delete track' }, { status: 500 });
  }
}
