// app/api/playlist/route.ts
// Playlist CRUD operations

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get playlists or single playlist
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('id');
  const userId = searchParams.get('userId');
  const isPublic = searchParams.get('public') === 'true';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const cursor = searchParams.get('cursor');

  try {
    // Get single playlist with tracks
    if (playlistId) {
      const playlist = await prisma.playlist.findUnique({
        where: { id: playlistId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          tracks: {
            include: {
              track: {
                select: {
                  id: true,
                  title: true,
                  ticker: true,
                  coverUrl: true,
                  duration: true,
                  playCount: true,
                  artist: {
                    select: {
                      id: true,
                      name: true,
                      avatarUrl: true,
                      isVerified: true,
                    },
                  },
                },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });

      if (!playlist) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
      }

      // Check if private playlist is accessible
      if (!playlist.isPublic && playlist.userId !== userId) {
        return NextResponse.json({ error: 'Playlist is private' }, { status: 403 });
      }

      return NextResponse.json({
        playlist: {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          coverUrl: playlist.coverUrl,
          isPublic: playlist.isPublic,
          user: playlist.user,
          tracks: playlist.tracks.map(pt => ({
            ...pt.track,
            position: pt.position,
            addedAt: pt.addedAt,
          })),
          trackCount: playlist.tracks.length,
          totalDuration: playlist.tracks.reduce((sum, pt) => sum + (pt.track.duration || 0), 0),
          createdAt: playlist.createdAt,
          updatedAt: playlist.updatedAt,
        },
      });
    }

    // Get user's playlists
    if (userId) {
      const where = {
        userId,
        ...(isPublic && { isPublic: true }),
      };

      const playlists = await prisma.playlist.findMany({
        where,
        include: {
          _count: {
            select: { tracks: true },
          },
          tracks: {
            take: 4,
            orderBy: { position: 'asc' },
            include: {
              track: {
                select: { coverUrl: true },
              },
            },
          },
        },
        take: limit,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { updatedAt: 'desc' },
      });

      const total = await prisma.playlist.count({ where });

      return NextResponse.json({
        playlists: playlists.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          coverUrl: p.coverUrl || p.tracks[0]?.track.coverUrl || null,
          isPublic: p.isPublic,
          trackCount: p._count.tracks,
          previewCovers: p.tracks.map(t => t.track.coverUrl).filter(Boolean),
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        total,
        nextCursor: playlists.length === limit ? playlists[playlists.length - 1].id : null,
      });
    }

    // Get public/featured playlists
    const playlists = await prisma.playlist.findMany({
      where: { isPublic: true },
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
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ playlists });

  } catch (error) {
    console.error('Playlist GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
  }
}

// POST - Create playlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, description, coverUrl, isPublic = false, trackIds = [] } = body;

    if (!userId || !name) {
      return NextResponse.json(
        { error: 'userId and name required' },
        { status: 400 }
      );
    }

    // Create playlist with initial tracks
    const playlist = await prisma.playlist.create({
      data: {
        userId,
        name,
        description,
        coverUrl,
        isPublic,
        tracks: {
          create: trackIds.map((trackId: string, index: number) => ({
            trackId,
            position: index,
          })),
        },
      },
      include: {
        tracks: {
          include: {
            track: {
              select: {
                id: true,
                title: true,
                coverUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        coverUrl: playlist.coverUrl,
        isPublic: playlist.isPublic,
        trackCount: playlist.tracks.length,
        createdAt: playlist.createdAt,
      },
    });

  } catch (error) {
    console.error('Playlist POST error:', error);
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
  }
}

// PATCH - Update playlist
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { playlistId, userId, name, description, coverUrl, isPublic } = body;

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

    // Update playlist
    const updated = await prisma.playlist.update({
      where: { id: playlistId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(coverUrl !== undefined && { coverUrl }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    return NextResponse.json({
      success: true,
      playlist: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        coverUrl: updated.coverUrl,
        isPublic: updated.isPublic,
        updatedAt: updated.updatedAt,
      },
    });

  } catch (error) {
    console.error('Playlist PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update playlist' }, { status: 500 });
  }
}

// DELETE - Delete playlist
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { playlistId, userId } = body;

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

    // Delete playlist (tracks are deleted via cascade)
    await prisma.playlist.delete({
      where: { id: playlistId },
    });

    return NextResponse.json({
      success: true,
      deleted: playlistId,
    });

  } catch (error) {
    console.error('Playlist DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 });
  }
}
