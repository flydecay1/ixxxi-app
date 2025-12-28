// app/api/user/history/route.ts
// Listening history API - track plays and sync across devices

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get listening history
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const cursor = searchParams.get('cursor');
  const period = searchParams.get('period'); // 'today' | 'week' | 'month' | 'all'

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    // Build date filter
    let dateFilter: Date | undefined;
    if (period === 'today') {
      dateFilter = new Date();
      dateFilter.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (period === 'month') {
      dateFilter = new Date();
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    }

    const where = {
      userId,
      ...(dateFilter && { createdAt: { gte: dateFilter } }),
    };

    // Get plays with track info
    const plays = await prisma.play.findMany({
      where,
      include: {
        track: {
          select: {
            id: true,
            title: true,
            ticker: true,
            coverUrl: true,
            duration: true,
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
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
    });

    // Group by track for "recently played" view (deduplicate)
    const recentTracks = new Map();
    for (const play of plays) {
      if (!recentTracks.has(play.trackId)) {
        recentTracks.set(play.trackId, {
          ...play.track,
          lastPlayedAt: play.createdAt,
          playCount: 1,
          totalDuration: play.duration,
        });
      } else {
        const existing = recentTracks.get(play.trackId);
        existing.playCount++;
        existing.totalDuration += play.duration;
      }
    }

    // Get total stats
    const [totalPlays, totalDuration] = await Promise.all([
      prisma.play.count({ where }),
      prisma.play.aggregate({
        where,
        _sum: { duration: true },
      }),
    ]);

    return NextResponse.json({
      history: plays.map(p => ({
        id: p.id,
        track: p.track,
        playedAt: p.createdAt,
        duration: p.duration,
        completed: p.completed,
        source: p.source,
      })),
      recentTracks: Array.from(recentTracks.values()),
      stats: {
        totalPlays,
        totalDuration: totalDuration._sum.duration || 0,
        uniqueTracks: recentTracks.size,
      },
      nextCursor: plays.length === limit ? plays[plays.length - 1].id : null,
    });

  } catch (error) {
    console.error('History error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

// POST - Record a play
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, trackId, duration = 0, completed = false, source = 'player' } = body;

    if (!userId || !trackId) {
      return NextResponse.json(
        { error: 'userId and trackId required' },
        { status: 400 }
      );
    }

    // Create play record
    const play = await prisma.play.create({
      data: {
        userId,
        trackId,
        duration,
        completed,
        source,
      },
    });

    // Update track stats
    await prisma.track.update({
      where: { id: trackId },
      data: {
        playCount: { increment: 1 },
        ...(completed && { uniquePlays: { increment: 1 } }),
      },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalPlays: { increment: 1 },
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      playId: play.id,
    });

  } catch (error) {
    console.error('Record play error:', error);
    return NextResponse.json({ error: 'Failed to record play' }, { status: 500 });
  }
}

// PATCH - Update play duration (for progress tracking)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { playId, duration, completed } = body;

    if (!playId) {
      return NextResponse.json(
        { error: 'playId required' },
        { status: 400 }
      );
    }

    const play = await prisma.play.update({
      where: { id: playId },
      data: {
        ...(duration !== undefined && { duration }),
        ...(completed !== undefined && { completed }),
      },
    });

    return NextResponse.json({
      success: true,
      play: {
        id: play.id,
        duration: play.duration,
        completed: play.completed,
      },
    });

  } catch (error) {
    console.error('Update play error:', error);
    return NextResponse.json({ error: 'Failed to update play' }, { status: 500 });
  }
}

// DELETE - Clear history
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, trackId, clearAll = false } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    if (clearAll) {
      // Clear all history for user
      const deleted = await prisma.play.deleteMany({
        where: { userId },
      });

      return NextResponse.json({
        success: true,
        deleted: deleted.count,
      });
    }

    if (trackId) {
      // Remove specific track from history
      const deleted = await prisma.play.deleteMany({
        where: { userId, trackId },
      });

      return NextResponse.json({
        success: true,
        deleted: deleted.count,
      });
    }

    return NextResponse.json(
      { error: 'Specify trackId or clearAll' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Clear history error:', error);
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 });
  }
}
