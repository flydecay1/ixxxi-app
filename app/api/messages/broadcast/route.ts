// app/api/messages/broadcast/route.ts
// Artist broadcast messaging - send to all followers or token holders

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Broadcast message to followers/holders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      artistId, 
      content, 
      audience = 'all', // 'all' | 'token_holders' | 'premium' | 'early_access'
      title,
      actionUrl,
      actionLabel,
    } = body;

    if (!artistId || !content) {
      return NextResponse.json({ 
        error: 'Artist ID and content required' 
      }, { status: 400 });
    }

    // Verify artist exists
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
      include: { user: true },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Get recipients based on audience
    let recipientIds: string[] = [];

    switch (audience) {
      case 'all':
        // All followers
        const allFollows = await prisma.follow.findMany({
          where: { followingId: artist.userId },
          select: { followerId: true },
        });
        recipientIds = allFollows.map(f => f.followerId);
        break;

      case 'token_holders':
        // Users who hold artist tokens (check wallet transactions)
        // For now, get users who purchased from this artist
        const purchasers = await prisma.purchase.findMany({
          where: {
            track: { artistId },
          },
          select: { buyerId: true },
          distinct: ['buyerId'],
        });
        recipientIds = purchasers.map(p => p.buyerId);
        break;

      case 'premium':
        // Premium tier followers
        const premiumFollows = await prisma.follow.findMany({
          where: {
            followingId: artist.userId,
            follower: {
              tier: { in: ['premium', 'pro'] },
            },
          },
          select: { followerId: true },
        });
        recipientIds = premiumFollows.map(f => f.followerId);
        break;

      case 'early_access':
        // Early access list members
        const earlyAccess = await prisma.earlyAccess.findMany({
          where: { artistId },
          select: { userId: true },
        });
        recipientIds = earlyAccess.map(e => e.userId);
        break;
    }

    if (recipientIds.length === 0) {
      return NextResponse.json({
        success: true,
        delivered: 0,
        message: 'No recipients found for selected audience',
      });
    }

    // Create broadcast record
    const broadcast = await prisma.broadcast.create({
      data: {
        artistId,
        title: title || `Message from ${artist.name}`,
        content,
        audience,
        actionUrl,
        actionLabel,
        recipientCount: recipientIds.length,
      },
    });

    // Create individual notifications for each recipient
    const notifications = await prisma.notification.createMany({
      data: recipientIds.map(userId => ({
        userId,
        type: 'broadcast',
        title: title || `New message from ${artist.name}`,
        message: content.substring(0, 200),
        data: JSON.stringify({
          artistId,
          artistName: artist.name,
          broadcastId: broadcast.id,
          actionUrl,
          actionLabel,
        }),
      })),
    });

    // TODO: Send push notifications to subscribed users

    return NextResponse.json({
      success: true,
      broadcastId: broadcast.id,
      delivered: recipientIds.length,
      audience,
    });

  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json({ error: 'Failed to send broadcast' }, { status: 500 });
  }
}

// GET - Get artist's broadcast history
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artistId');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!artistId) {
    return NextResponse.json({ error: 'Artist ID required' }, { status: 400 });
  }

  try {
    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where: { artistId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          content: true,
          audience: true,
          recipientCount: true,
          actionUrl: true,
          actionLabel: true,
          createdAt: true,
        },
      }),
      prisma.broadcast.count({
        where: { artistId },
      }),
    ]);

    return NextResponse.json({
      broadcasts,
      total,
      hasMore: offset + broadcasts.length < total,
    });

  } catch (error) {
    console.error('Get broadcasts error:', error);
    return NextResponse.json({ error: 'Failed to get broadcasts' }, { status: 500 });
  }
}
