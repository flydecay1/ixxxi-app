// app/api/social/follow/route.ts
// Follow/unfollow users and artists

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get follow status or followers/following list
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const targetId = searchParams.get('targetId');
  const type = searchParams.get('type'); // 'followers' | 'following' | 'status'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const cursor = searchParams.get('cursor');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    // Check follow status between two users
    if (type === 'status' && targetId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: targetId,
          },
        },
      });

      return NextResponse.json({
        isFollowing: !!follow,
        followedAt: follow?.createdAt || null,
      });
    }

    // Get followers list
    if (type === 'followers') {
      const followers = await prisma.follow.findMany({
        where: { followingId: userId },
        include: {
          follower: {
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
        take: limit,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { createdAt: 'desc' },
      });

      const count = await prisma.follow.count({
        where: { followingId: userId },
      });

      return NextResponse.json({
        followers: followers.map(f => ({
          id: f.follower.id,
          username: f.follower.username,
          avatarUrl: f.follower.avatarUrl,
          wallet: f.follower.walletAddress,
          artist: f.follower.artist,
          followedAt: f.createdAt,
        })),
        total: count,
        nextCursor: followers.length === limit ? followers[followers.length - 1].id : null,
      });
    }

    // Get following list
    if (type === 'following') {
      const following = await prisma.follow.findMany({
        where: { followerId: userId },
        include: {
          following: {
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
        take: limit,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { createdAt: 'desc' },
      });

      const count = await prisma.follow.count({
        where: { followerId: userId },
      });

      return NextResponse.json({
        following: following.map(f => ({
          id: f.following.id,
          username: f.following.username,
          avatarUrl: f.following.avatarUrl,
          wallet: f.following.walletAddress,
          artist: f.following.artist,
          followedAt: f.createdAt,
        })),
        total: count,
        nextCursor: following.length === limit ? following[following.length - 1].id : null,
      });
    }

    // Get both counts
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return NextResponse.json({
      userId,
      followersCount,
      followingCount,
    });

  } catch (error) {
    console.error('Follow GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch follow data' }, { status: 500 });
  }
}

// POST - Follow a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { followerId, followingId } = body;

    if (!followerId || !followingId) {
      return NextResponse.json(
        { error: 'followerId and followingId required' },
        { status: 400 }
      );
    }

    if (followerId === followingId) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Already following this user' },
        { status: 400 }
      );
    }

    // Create follow relationship
    const follow = await prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
    });

    // Update follower counts
    await prisma.$transaction([
      // Increment following user's artist follower count if they're an artist
      prisma.artist.updateMany({
        where: { userId: followingId },
        data: { totalFollowers: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      follow: {
        id: follow.id,
        followerId,
        followingId,
        createdAt: follow.createdAt,
      },
    });

  } catch (error) {
    console.error('Follow POST error:', error);
    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 });
  }
}

// DELETE - Unfollow a user
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { followerId, followingId } = body;

    if (!followerId || !followingId) {
      return NextResponse.json(
        { error: 'followerId and followingId required' },
        { status: 400 }
      );
    }

    // Delete follow relationship
    const deleted = await prisma.follow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Follow relationship not found' },
        { status: 404 }
      );
    }

    // Update follower counts
    await prisma.artist.updateMany({
      where: { userId: followingId },
      data: { totalFollowers: { decrement: 1 } },
    });

    return NextResponse.json({
      success: true,
      unfollowed: followingId,
    });

  } catch (error) {
    console.error('Follow DELETE error:', error);
    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 });
  }
}
