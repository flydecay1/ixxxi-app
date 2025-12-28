// app/api/social/comment/route.ts
// Track comments and replies

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get comments for a track
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId');
  const parentId = searchParams.get('parentId'); // For fetching replies
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const cursor = searchParams.get('cursor');
  const sort = searchParams.get('sort') || 'newest'; // 'newest' | 'oldest' | 'popular'

  if (!trackId) {
    return NextResponse.json({ error: 'trackId required' }, { status: 400 });
  }

  try {
    const orderBy = sort === 'oldest' 
      ? { createdAt: 'asc' as const }
      : sort === 'popular'
        ? { likeCount: 'desc' as const }
        : { createdAt: 'desc' as const };

    // Fetch top-level comments or replies
    const comments = await prisma.comment.findMany({
      where: {
        trackId,
        parentId: parentId || null, // null for top-level comments
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            walletAddress: true,
            artist: {
              select: {
                id: true,
                name: true,
                isVerified: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy,
    });

    const total = await prisma.comment.count({
      where: {
        trackId,
        parentId: parentId || null,
      },
    });

    return NextResponse.json({
      comments: comments.map(c => ({
        id: c.id,
        content: c.content,
        timestamp: c.timestamp, // Timestamp in track (e.g., "1:23")
        user: c.user,
        likeCount: c.likeCount,
        replyCount: c._count.replies,
        isEdited: c.isEdited,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
      nextCursor: comments.length === limit ? comments[comments.length - 1].id : null,
    });

  } catch (error) {
    console.error('Comment GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST - Create a comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, trackId, content, timestamp, parentId } = body;

    if (!userId || !trackId || !content) {
      return NextResponse.json(
        { error: 'userId, trackId, and content required' },
        { status: 400 }
      );
    }

    // Validate content length
    if (content.length > 500) {
      return NextResponse.json(
        { error: 'Comment must be 500 characters or less' },
        { status: 400 }
      );
    }

    // If replying, verify parent exists
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        );
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        userId,
        trackId,
        content,
        timestamp: timestamp || null,
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            walletAddress: true,
            artist: {
              select: {
                id: true,
                name: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        timestamp: comment.timestamp,
        user: comment.user,
        likeCount: 0,
        replyCount: 0,
        createdAt: comment.createdAt,
      },
    });

  } catch (error) {
    console.error('Comment POST error:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

// PATCH - Edit a comment
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { commentId, userId, content } = body;

    if (!commentId || !userId || !content) {
      return NextResponse.json(
        { error: 'commentId, userId, and content required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Update comment
    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
        isEdited: true,
      },
    });

    return NextResponse.json({
      success: true,
      comment: {
        id: updated.id,
        content: updated.content,
        isEdited: true,
        updatedAt: updated.updatedAt,
      },
    });

  } catch (error) {
    console.error('Comment PATCH error:', error);
    return NextResponse.json({ error: 'Failed to edit comment' }, { status: 500 });
  }
}

// DELETE - Delete a comment
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { commentId, userId } = body;

    if (!commentId || !userId) {
      return NextResponse.json(
        { error: 'commentId and userId required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (comment.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Delete comment and all replies
    await prisma.comment.deleteMany({
      where: {
        OR: [
          { id: commentId },
          { parentId: commentId },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      deleted: commentId,
    });

  } catch (error) {
    console.error('Comment DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
