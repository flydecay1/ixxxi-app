// app/api/social/mentions/route.ts
// @mentions system for comments and messages

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get mentions for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const unreadOnly = searchParams.get('unread') === 'true';
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    const where: any = { mentionedUserId: userId };
    if (unreadOnly) where.readAt = null;

    const [mentions, total, unreadCount] = await Promise.all([
      prisma.mention.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          mentionedBy: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              artist: { select: { name: true, isVerified: true } },
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
              track: {
                select: { id: true, title: true, coverUrl: true },
              },
            },
          },
        },
      }),
      prisma.mention.count({ where }),
      prisma.mention.count({ where: { mentionedUserId: userId, readAt: null } }),
    ]);

    return NextResponse.json({
      mentions,
      total,
      unreadCount,
      hasMore: offset + mentions.length < total,
    });

  } catch (error) {
    console.error('Get mentions error:', error);
    return NextResponse.json({ error: 'Failed to get mentions' }, { status: 500 });
  }
}

// POST - Create mention (called when comment/message contains @username)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mentionedByUserId, mentionedUsername, commentId, messageId, context } = body;

    if (!mentionedByUserId || !mentionedUsername) {
      return NextResponse.json({
        error: 'Mentioner ID and mentioned username required',
      }, { status: 400 });
    }

    // Find mentioned user
    const mentionedUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: mentionedUsername },
          { username: { equals: mentionedUsername, mode: 'insensitive' } },
        ],
      },
    });

    if (!mentionedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Don't create mention if user mentions themselves
    if (mentionedUser.id === mentionedByUserId) {
      return NextResponse.json({ success: true, selfMention: true });
    }

    // Create mention
    const mention = await prisma.mention.create({
      data: {
        mentionedUserId: mentionedUser.id,
        mentionedByUserId,
        commentId,
        messageId,
        context,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: mentionedUser.id,
        type: 'mention',
        title: 'You were mentioned',
        message: context || 'Someone mentioned you',
        data: JSON.stringify({
          mentionId: mention.id,
          commentId,
          messageId,
          mentionedByUserId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      mentionId: mention.id,
    });

  } catch (error) {
    console.error('Create mention error:', error);
    return NextResponse.json({ error: 'Failed to create mention' }, { status: 500 });
  }
}

// PATCH - Mark mentions as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, mentionIds } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const where: any = { mentionedUserId: userId, readAt: null };
    if (mentionIds?.length) {
      where.id = { in: mentionIds };
    }

    const updated = await prisma.mention.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      markedRead: updated.count,
    });

  } catch (error) {
    console.error('Mark mentions read error:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}

// Helper: Extract mentions from text
export function extractMentions(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.substring(1)))];
}
