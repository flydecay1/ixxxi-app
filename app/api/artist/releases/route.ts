// app/api/artist/releases/route.ts
// Release management - scheduling, publishing, analytics

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List artist releases
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artistId');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!artistId) {
    return NextResponse.json({ error: 'Artist ID required' }, { status: 400 });
  }

  try {
    const where: any = { artistId };
    if (status) where.status = status;

    const [releases, total] = await Promise.all([
      prisma.release.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          tracks: {
            orderBy: { trackNumber: 'asc' },
            select: {
              id: true,
              title: true,
              trackNumber: true,
              playCount: true,
              likeCount: true,
              duration: true,
            },
          },
          _count: {
            select: { tracks: true },
          },
        },
      }),
      prisma.release.count({ where }),
    ]);

    // Calculate stats for each release
    const releasesWithStats = releases.map(r => {
      const totalPlays = r.tracks.reduce((sum, t) => sum + t.playCount, 0);
      const totalLikes = r.tracks.reduce((sum, t) => sum + t.likeCount, 0);
      const totalDuration = r.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

      return {
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        coverUrl: r.coverUrl,
        genre: r.genre,
        releaseDate: r.releaseDate,
        scheduledAt: r.scheduledAt,
        publishedAt: r.publishedAt,
        trackCount: r._count.tracks,
        totalPlays,
        totalLikes,
        totalDuration,
        tracks: r.tracks,
        createdAt: r.createdAt,
      };
    });

    return NextResponse.json({
      releases: releasesWithStats,
      total,
      hasMore: offset + releases.length < total,
    });

  } catch (error) {
    console.error('Get releases error:', error);
    return NextResponse.json({ error: 'Failed to get releases' }, { status: 500 });
  }
}

// POST - Create a new release
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      artistId,
      title,
      type = 'album',
      description,
      coverUrl,
      genre,
      releaseDate,
      scheduledAt,
    } = body;

    if (!artistId || !title) {
      return NextResponse.json({
        error: 'Artist ID and title required',
      }, { status: 400 });
    }

    const release = await prisma.release.create({
      data: {
        artistId,
        title,
        type,
        description,
        coverUrl,
        genre,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'draft',
      },
    });

    return NextResponse.json({
      success: true,
      release,
    });

  } catch (error) {
    console.error('Create release error:', error);
    return NextResponse.json({ error: 'Failed to create release' }, { status: 500 });
  }
}

// PATCH - Update release (schedule, publish, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      releaseId,
      artistId,
      action,
      ...updates
    } = body;

    if (!releaseId || !artistId) {
      return NextResponse.json({
        error: 'Release ID and artist ID required',
      }, { status: 400 });
    }

    // Verify ownership
    const release = await prisma.release.findFirst({
      where: { id: releaseId, artistId },
      include: { tracks: true },
    });

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    let updateData: any = {};

    switch (action) {
      case 'schedule':
        // Schedule release for future date
        if (!updates.scheduledAt) {
          return NextResponse.json({
            error: 'Scheduled date required',
          }, { status: 400 });
        }
        updateData = {
          scheduledAt: new Date(updates.scheduledAt),
          status: 'scheduled',
        };
        
        // Update all tracks to scheduled
        await prisma.track.updateMany({
          where: { releaseId },
          data: {
            scheduledReleaseAt: new Date(updates.scheduledAt),
            status: 'scheduled',
          },
        });
        break;

      case 'publish':
        // Publish immediately
        updateData = {
          status: 'published',
          publishedAt: new Date(),
        };
        
        // Update all tracks to published
        await prisma.track.updateMany({
          where: { releaseId },
          data: {
            status: 'published',
            publishedAt: new Date(),
          },
        });
        break;

      case 'unpublish':
        // Take offline
        updateData = {
          status: 'draft',
          publishedAt: null,
        };
        
        await prisma.track.updateMany({
          where: { releaseId },
          data: {
            status: 'ready',
            publishedAt: null,
          },
        });
        break;

      case 'archive':
        updateData = { status: 'archived' };
        await prisma.track.updateMany({
          where: { releaseId },
          data: { status: 'archived' },
        });
        break;

      default:
        // General update
        const { title, description, coverUrl, genre, releaseDate } = updates;
        updateData = {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(coverUrl && { coverUrl }),
          ...(genre && { genre }),
          ...(releaseDate && { releaseDate: new Date(releaseDate) }),
        };
    }

    const updated = await prisma.release.update({
      where: { id: releaseId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      release: updated,
      action,
    });

  } catch (error) {
    console.error('Update release error:', error);
    return NextResponse.json({ error: 'Failed to update release' }, { status: 500 });
  }
}

// DELETE - Delete a release
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { releaseId, artistId } = body;

    if (!releaseId || !artistId) {
      return NextResponse.json({
        error: 'Release ID and artist ID required',
      }, { status: 400 });
    }

    // Verify ownership
    const release = await prisma.release.findFirst({
      where: { id: releaseId, artistId },
    });

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    // Delete all tracks first (cascade will handle related records)
    await prisma.track.deleteMany({
      where: { releaseId },
    });

    // Delete release
    await prisma.release.delete({
      where: { id: releaseId },
    });

    // Update artist track count
    await prisma.artist.update({
      where: { id: artistId },
      data: {
        totalTracks: { decrement: release.trackCount },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Release deleted',
    });

  } catch (error) {
    console.error('Delete release error:', error);
    return NextResponse.json({ error: 'Failed to delete release' }, { status: 500 });
  }
}
