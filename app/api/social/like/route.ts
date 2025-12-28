// app/api/social/like/route.ts
// Like/unlike tracks

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Check like status or get liked tracks
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const trackId = searchParams.get('trackId');
  const type = searchParams.get('type'); // 'status' | 'list' | 'track-likes'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const cursor = searchParams.get('cursor');

  try {
    // Check if user liked a specific track
    if (type === 'status' && userId && trackId) {
      const like = await prisma.like.findUnique({
        where: {
          trackId_userId: {
            trackId,
            userId,
          },
        },
      });

      return NextResponse.json({
        isLiked: !!like,
        likedAt: like?.createdAt || null,
      });
    }

    // Get user's liked tracks
    if (type === 'list' && userId) {
      const likes = await prisma.like.findMany({
        where: { userId },
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
        take: limit,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { createdAt: 'desc' },
      });

      const total = await prisma.like.count({ where: { userId } });

      return NextResponse.json({
        likes: likes.map(l => ({
          ...l.track,
          likedAt: l.createdAt,
        })),
        total,
        nextCursor: likes.length === limit ? likes[likes.length - 1].id : null,
      });
    }

    // Get users who liked a track
    if (type === 'track-likes' && trackId) {
      const likes = await prisma.like.findMany({
        where: { trackId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              walletAddress: true,
            },
          },
        },
        take: limit,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { createdAt: 'desc' },
      });

      const total = await prisma.like.count({ where: { trackId } });

      return NextResponse.json({
        users: likes.map(l => ({
          ...l.user,
          likedAt: l.createdAt,
        })),
        total,
        nextCursor: likes.length === limit ? likes[likes.length - 1].id : null,
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error) {
    console.error('Like GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch like data' }, { status: 500 });
  }
}

// POST - Like a track
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, trackId } = body;

    if (!userId || !trackId) {
      return NextResponse.json(
        { error: 'userId and trackId required' },
        { status: 400 }
      );
    }

    // Check if already liked
    const existing = await prisma.like.findUnique({
      where: {
        trackId_userId: {
          trackId,
          userId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Track already liked' },
        { status: 400 }
      );
    }

    // Create like
    const like = await prisma.like.create({
      data: {
        userId,
        trackId,
      },
    });

    // Increment track like count
    await prisma.track.update({
      where: { id: trackId },
      data: { likeCount: { increment: 1 } },
    });

    // Get updated count
    const likeCount = await prisma.like.count({ where: { trackId } });

    return NextResponse.json({
      success: true,
      like: {
        id: like.id,
        trackId,
        userId,
        createdAt: like.createdAt,
      },
      likeCount,
    });

  } catch (error) {
    console.error('Like POST error:', error);
    return NextResponse.json({ error: 'Failed to like track' }, { status: 500 });
  }
}

// DELETE - Unlike a track
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, trackId } = body;

    if (!userId || !trackId) {
      return NextResponse.json(
        { error: 'userId and trackId required' },
        { status: 400 }
      );
    }

    // Delete like
    const deleted = await prisma.like.deleteMany({
      where: {
        userId,
        trackId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Like not found' },
        { status: 404 }
      );
    }

    // Decrement track like count
    await prisma.track.update({
      where: { id: trackId },
      data: { likeCount: { decrement: 1 } },
    });

    // Get updated count
    const likeCount = await prisma.like.count({ where: { trackId } });

    return NextResponse.json({
      success: true,
      unliked: trackId,
      likeCount,
    });

  } catch (error) {
    console.error('Like DELETE error:', error);
    return NextResponse.json({ error: 'Failed to unlike track' }, { status: 500 });
  }
}
