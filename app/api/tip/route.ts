// app/api/tip/route.ts
// Tipping / donations system for artists

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/tip - Get tip history
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const artistId = searchParams.get('artistId');
  const type = searchParams.get('type') || 'sent'; // "sent" | "received"
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // Get tips sent by a user
    if (userId && type === 'sent') {
      const tips = await prisma.tip.findMany({
        where: { senderId: userId },
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isVerified: true,
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
        take: limit,
      });

      const total = await prisma.tip.aggregate({
        where: { senderId: userId },
        _sum: { amount: true },
        _count: true,
      });

      return NextResponse.json({
        tips,
        totalSent: total._sum.amount || 0,
        tipCount: total._count,
      });
    }

    // Get tips received by an artist
    if (artistId) {
      const tips = await prisma.tip.findMany({
        where: { artistId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
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
        take: limit,
      });

      const stats = await prisma.tip.aggregate({
        where: { artistId },
        _sum: { amount: true },
        _count: true,
      });

      // Top supporters
      const topSupporters = await prisma.tip.groupBy({
        by: ['senderId'],
        where: { artistId },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      });

      const supporterIds = topSupporters.map(s => s.senderId);
      const supporterUsers = await prisma.user.findMany({
        where: { id: { in: supporterIds } },
        select: { id: true, username: true, avatarUrl: true },
      });

      const supporters = topSupporters.map(s => ({
        user: supporterUsers.find(u => u.id === s.senderId),
        totalTipped: s._sum.amount,
        tipCount: s._count,
      }));

      return NextResponse.json({
        tips,
        totalReceived: stats._sum.amount || 0,
        tipCount: stats._count,
        topSupporters: supporters,
      });
    }

    return NextResponse.json({ error: 'userId or artistId required' }, { status: 400 });
  } catch (error) {
    console.error('Get tips error:', error);
    return NextResponse.json({ error: 'Failed to get tips' }, { status: 500 });
  }
}

// POST /api/tip - Send a tip
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      senderId, 
      artistId, 
      amount, 
      currency = 'SOL', 
      message, 
      trackId,
      txSignature,
      isAnonymous = false,
    } = body;

    if (!senderId || !artistId || !amount) {
      return NextResponse.json({ 
        error: 'senderId, artistId, and amount required' 
      }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    // Validate artist exists
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
      select: { id: true, name: true, userId: true, totalRevenue: true },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Can't tip yourself
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      include: { artist: true },
    });

    if (sender?.artist?.id === artistId) {
      return NextResponse.json({ error: 'Cannot tip yourself' }, { status: 400 });
    }

    // Platform fee (2.5%)
    const platformFee = amount * 0.025;
    const artistAmount = amount - platformFee;

    // Create tip record
    const tip = await prisma.tip.create({
      data: {
        senderId,
        artistId,
        trackId,
        amount,
        currency,
        message: message?.substring(0, 500), // Max 500 chars
        txSignature,
        isAnonymous,
        platformFee,
        artistAmount,
      },
    });

    // Update artist revenue
    await prisma.artist.update({
      where: { id: artistId },
      data: {
        totalRevenue: { increment: artistAmount },
      },
    });

    // Create notification for artist
    await prisma.notification.create({
      data: {
        userId: artist.userId,
        type: 'tip',
        title: 'You received a tip! 💰',
        message: isAnonymous 
          ? `Someone tipped you ${amount} ${currency}${message ? `: "${message}"` : ''}`
          : `${sender?.username || 'A fan'} tipped you ${amount} ${currency}${message ? `: "${message}"` : ''}`,
        data: JSON.stringify({
          tipId: tip.id,
          amount,
          currency,
          trackId,
          senderId: isAnonymous ? null : senderId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      tip: {
        id: tip.id,
        amount: tip.amount,
        currency: tip.currency,
        artistAmount,
        platformFee,
        message: tip.message,
      },
    });
  } catch (error) {
    console.error('Send tip error:', error);
    return NextResponse.json({ error: 'Failed to send tip' }, { status: 500 });
  }
}

// Tip presets for quick tipping
export const TIP_PRESETS = {
  SOL: [0.01, 0.05, 0.1, 0.5, 1],
  USDC: [1, 5, 10, 25, 50],
};
