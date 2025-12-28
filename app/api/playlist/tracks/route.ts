// app/api/playlist/tracks/route.ts
// Manage tracks within playlists

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Add track(s) to playlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playlistId, userId, trackId, trackIds } = body;

    if (!playlistId || !userId) {
      return NextResponse.json(
        { error: 'playlistId and userId required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get current max position
    const lastTrack = await prisma.playlistTrack.findFirst({
      where: { playlistId },
      orderBy: { position: 'desc' },
    });
    const nextPosition = (lastTrack?.position ?? -1) + 1;

    // Add single track or multiple
    const tracksToAdd = trackIds || [trackId];
    
    if (!tracksToAdd.length || !tracksToAdd[0]) {
      return NextResponse.json(
        { error: 'trackId or trackIds required' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const existing = await prisma.playlistTrack.findMany({
      where: {
        playlistId,
        trackId: { in: tracksToAdd },
      },
      select: { trackId: true },
    });
    const existingIds = new Set(existing.map(e => e.trackId));
    const newTracks = tracksToAdd.filter((id: string) => !existingIds.has(id));

    if (newTracks.length === 0) {
      return NextResponse.json(
        { error: 'All tracks already in playlist' },
        { status: 400 }
      );
    }

    // Add tracks
    await prisma.playlistTrack.createMany({
      data: newTracks.map((id: string, index: number) => ({
        playlistId,
        trackId: id,
        position: nextPosition + index,
      })),
    });

    // Update playlist timestamp
    await prisma.playlist.update({
      where: { id: playlistId },
      data: { updatedAt: new Date() },
    });

    const trackCount = await prisma.playlistTrack.count({
      where: { playlistId },
    });

    return NextResponse.json({
      success: true,
      added: newTracks.length,
      skipped: tracksToAdd.length - newTracks.length,
      trackCount,
    });

  } catch (error) {
    console.error('Playlist tracks POST error:', error);
    return NextResponse.json({ error: 'Failed to add tracks' }, { status: 500 });
  }
}

// DELETE - Remove track from playlist
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { playlistId, userId, trackId } = body;

    if (!playlistId || !userId || !trackId) {
      return NextResponse.json(
        { error: 'playlistId, userId, and trackId required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Remove track
    const deleted = await prisma.playlistTrack.deleteMany({
      where: {
        playlistId,
        trackId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Track not in playlist' }, { status: 404 });
    }

    // Reorder remaining tracks
    const remaining = await prisma.playlistTrack.findMany({
      where: { playlistId },
      orderBy: { position: 'asc' },
    });

    await Promise.all(
      remaining.map((pt, index) =>
        prisma.playlistTrack.update({
          where: { id: pt.id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({
      success: true,
      removed: trackId,
      trackCount: remaining.length,
    });

  } catch (error) {
    console.error('Playlist tracks DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove track' }, { status: 500 });
  }
}

// PATCH - Reorder tracks in playlist
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { playlistId, userId, trackIds } = body;

    if (!playlistId || !userId || !trackIds || !Array.isArray(trackIds)) {
      return NextResponse.json(
        { error: 'playlistId, userId, and trackIds array required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    if (playlist.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Update positions
    await Promise.all(
      trackIds.map((trackId: string, index: number) =>
        prisma.playlistTrack.updateMany({
          where: {
            playlistId,
            trackId,
          },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({
      success: true,
      reordered: true,
    });

  } catch (error) {
    console.error('Playlist tracks PATCH error:', error);
    return NextResponse.json({ error: 'Failed to reorder tracks' }, { status: 500 });
  }
}
