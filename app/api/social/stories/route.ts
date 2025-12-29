// app/api/social/stories/route.ts
// Stories - ephemeral content that disappears after 24 hours

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const STORY_DURATION_HOURS = 24;

// GET - Get stories from followed users or specific user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const viewerId = searchParams.get('viewerId');
  const type = searchParams.get('type') || 'feed'; // 'feed' | 'user' | 'own'

  try {
    const expiryDate = new Date(Date.now() - STORY_DURATION_HOURS * 60 * 60 * 1000);

    if (type === 'own' && userId) {
      // Get user's own stories (including expired for management)
      const stories = await prisma.story.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { views: true } },
        },
      });

      return NextResponse.json({
        stories: stories.map(s => ({
          ...s,
          isExpired: s.createdAt < expiryDate,
          viewCount: s._count.views,
        })),
      });
    }

    if (type === 'user' && userId) {
      // Get specific user's active stories
      const stories = await prisma.story.findMany({
        where: {
          userId,
          createdAt: { gte: expiryDate },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              artist: { select: { name: true, isVerified: true } },
            },
          },
          views: viewerId ? {
            where: { userId: viewerId },
            select: { id: true },
          } : false,
        },
      });

      return NextResponse.json({
        user: stories[0]?.user,
        stories: stories.map(s => ({
          id: s.id,
          type: s.type,
          mediaUrl: s.mediaUrl,
          caption: s.caption,
          trackId: s.trackId,
          linkUrl: s.linkUrl,
          createdAt: s.createdAt,
          expiresAt: new Date(s.createdAt.getTime() + STORY_DURATION_HOURS * 60 * 60 * 1000),
          viewed: viewerId ? s.views.length > 0 : undefined,
        })),
      });
    }

    // Get stories feed from followed users
    if (!viewerId) {
      return NextResponse.json({ error: 'Viewer ID required for feed' }, { status: 400 });
    }

    // Get followed user IDs
    const following = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    // Get users with active stories
    const usersWithStories = await prisma.user.findMany({
      where: {
        id: { in: followingIds },
        stories: {
          some: {
            createdAt: { gte: expiryDate },
          },
        },
      },
      include: {
        artist: { select: { name: true, isVerified: true } },
        stories: {
          where: { createdAt: { gte: expiryDate } },
          orderBy: { createdAt: 'asc' },
          include: {
            views: {
              where: { userId: viewerId },
              select: { id: true },
            },
          },
        },
      },
    });

    // Sort users: unviewed stories first, then by most recent
    const storyFeed = usersWithStories
      .map(user => {
        const hasUnviewed = user.stories.some(s => s.views.length === 0);
        const latestStory = user.stories[user.stories.length - 1];
        
        return {
          user: {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            artistName: user.artist?.name,
            isVerified: user.artist?.isVerified || false,
          },
          storyCount: user.stories.length,
          hasUnviewed,
          latestAt: latestStory?.createdAt,
          previewUrl: user.stories[0]?.mediaUrl,
        };
      })
      .sort((a, b) => {
        if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
        return new Date(b.latestAt!).getTime() - new Date(a.latestAt!).getTime();
      });

    return NextResponse.json({ storyFeed });

  } catch (error) {
    console.error('Get stories error:', error);
    return NextResponse.json({ error: 'Failed to get stories' }, { status: 500 });
  }
}

// POST - Create a story
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      type = 'image', // 'image' | 'video' | 'track' | 'text'
      mediaUrl,
      caption,
      trackId,
      linkUrl,
      backgroundColor,
      textColor,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Validate required fields based on type
    if (type === 'image' || type === 'video') {
      if (!mediaUrl) {
        return NextResponse.json({ error: 'Media URL required' }, { status: 400 });
      }
    }

    if (type === 'track' && !trackId) {
      return NextResponse.json({ error: 'Track ID required for track stories' }, { status: 400 });
    }

    // Check story limit (max 10 per day)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentStories = await prisma.story.count({
      where: { userId, createdAt: { gte: dayAgo } },
    });

    if (recentStories >= 10) {
      return NextResponse.json({
        error: 'Maximum 10 stories per 24 hours',
      }, { status: 429 });
    }

    const story = await prisma.story.create({
      data: {
        userId,
        type,
        mediaUrl,
        caption,
        trackId,
        linkUrl,
        backgroundColor,
        textColor,
      },
    });

    return NextResponse.json({
      success: true,
      story: {
        id: story.id,
        type: story.type,
        createdAt: story.createdAt,
        expiresAt: new Date(story.createdAt.getTime() + STORY_DURATION_HOURS * 60 * 60 * 1000),
      },
    });

  } catch (error) {
    console.error('Create story error:', error);
    return NextResponse.json({ error: 'Failed to create story' }, { status: 500 });
  }
}

// PATCH - Record story view
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { storyId, viewerId } = body;

    if (!storyId || !viewerId) {
      return NextResponse.json({
        error: 'Story ID and viewer ID required',
      }, { status: 400 });
    }

    // Check if already viewed
    const existing = await prisma.storyView.findFirst({
      where: { storyId, userId: viewerId },
    });

    if (existing) {
      return NextResponse.json({ success: true, alreadyViewed: true });
    }

    // Record view
    await prisma.storyView.create({
      data: { storyId, userId: viewerId },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Record view error:', error);
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
  }
}

// DELETE - Delete a story
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { storyId, userId } = body;

    if (!storyId || !userId) {
      return NextResponse.json({
        error: 'Story ID and user ID required',
      }, { status: 400 });
    }

    // Verify ownership
    const story = await prisma.story.findFirst({
      where: { id: storyId, userId },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Delete story and views (cascade)
    await prisma.story.delete({
      where: { id: storyId },
    });

    return NextResponse.json({
      success: true,
      message: 'Story deleted',
    });

  } catch (error) {
    console.error('Delete story error:', error);
    return NextResponse.json({ error: 'Failed to delete story' }, { status: 500 });
  }
}
