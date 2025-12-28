// app/api/social/activity/route.ts
// Activity feed - recent actions from followed users

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface ActivityItem {
  id: string;
  type: 'new_track' | 'like' | 'follow' | 'playlist' | 'comment' | 'purchase';
  actor: {
    id: string;
    username: string | null;
    avatarUrl: string | null;
    artist?: {
      id: string;
      name: string;
      isVerified: boolean;
    } | null;
  };
  target?: {
    type: 'track' | 'user' | 'playlist';
    id: string;
    title?: string;
    name?: string;
    coverUrl?: string;
  };
  timestamp: Date;
}

// GET - Get activity feed for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const type = searchParams.get('type'); // Filter by activity type
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50);
  const cursor = searchParams.get('cursor');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    // Get list of followed users
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return NextResponse.json({
        activities: [],
        message: 'Follow some artists to see activity!',
      });
    }

    const activities: ActivityItem[] = [];

    // Get recent tracks from followed artists
    if (!type || type === 'new_track') {
      const tracks = await prisma.track.findMany({
        where: {
          artist: {
            userId: { in: followingIds },
          },
          status: 'published',
          publishedAt: { not: null },
        },
        include: {
          artist: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: 20,
      });

      for (const track of tracks) {
        activities.push({
          id: `track_${track.id}`,
          type: 'new_track',
          actor: {
            id: track.artist.user.id,
            username: track.artist.user.username,
            avatarUrl: track.artist.user.avatarUrl,
            artist: {
              id: track.artist.id,
              name: track.artist.name,
              isVerified: track.artist.isVerified,
            },
          },
          target: {
            type: 'track',
            id: track.id,
            title: track.title,
            coverUrl: track.coverUrl || undefined,
          },
          timestamp: track.publishedAt!,
        });
      }
    }

    // Get recent likes from followed users
    if (!type || type === 'like') {
      const likes = await prisma.like.findMany({
        where: {
          userId: { in: followingIds },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              artist: {
                select: {
                  id: true,
                  name: true,
                  isVerified: true,
                },
              },
            },
          },
          track: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      for (const like of likes) {
        activities.push({
          id: `like_${like.id}`,
          type: 'like',
          actor: {
            id: like.user.id,
            username: like.user.username,
            avatarUrl: like.user.avatarUrl,
            artist: like.user.artist,
          },
          target: {
            type: 'track',
            id: like.track.id,
            title: like.track.title,
            coverUrl: like.track.coverUrl || undefined,
          },
          timestamp: like.createdAt,
        });
      }
    }

    // Get recent follows from followed users
    if (!type || type === 'follow') {
      const follows = await prisma.follow.findMany({
        where: {
          followerId: { in: followingIds },
        },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              artist: {
                select: {
                  id: true,
                  name: true,
                  isVerified: true,
                },
              },
            },
          },
          following: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
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
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      for (const follow of follows) {
        activities.push({
          id: `follow_${follow.id}`,
          type: 'follow',
          actor: {
            id: follow.follower.id,
            username: follow.follower.username,
            avatarUrl: follow.follower.avatarUrl,
            artist: follow.follower.artist,
          },
          target: {
            type: 'user',
            id: follow.following.id,
            name: follow.following.artist?.name || follow.following.username || 'User',
          },
          timestamp: follow.createdAt,
        });
      }
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = activities.findIndex(a => a.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedActivities = activities.slice(startIndex, startIndex + limit);
    const nextCursor = paginatedActivities.length === limit 
      ? paginatedActivities[paginatedActivities.length - 1].id 
      : null;

    return NextResponse.json({
      activities: paginatedActivities,
      nextCursor,
      total: activities.length,
    });

  } catch (error) {
    console.error('Activity feed error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
