// app/api/track/play/route.ts
// Track play logging API - record plays for analytics

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublicKey } from '@solana/web3.js';

// Rate limit map (in production, use Redis)
const playRateLimit = new Map<string, { count: number; resetAt: number }>();

// POST - Record a play
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, trackId, duration } = body;

    if (!trackId || duration === undefined) {
      return NextResponse.json({ error: 'trackId and duration required' }, { status: 400 });
    }

    // Validate duration (minimum 30 seconds to count as a play)
    const playDuration = Math.max(0, Math.min(duration, 600)); // Cap at 10 minutes
    if (playDuration < 30) {
      return NextResponse.json({ error: 'Minimum play duration is 30 seconds' }, { status: 400 });
    }

    // Rate limiting: max 100 plays per hour per IP/wallet
    const clientId = walletAddress || request.headers.get('x-forwarded-for') || 'anonymous';
    const now = Date.now();
    const rateLimit = playRateLimit.get(clientId);
    
    if (rateLimit) {
      if (now < rateLimit.resetAt) {
        if (rateLimit.count >= 100) {
          return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }
        rateLimit.count++;
      } else {
        playRateLimit.set(clientId, { count: 1, resetAt: now + 3600000 });
      }
    } else {
      playRateLimit.set(clientId, { count: 1, resetAt: now + 3600000 });
    }

    // Verify track exists
    const track = await prisma.track.findUnique({
      where: { id: trackId }
    });

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Get user if wallet provided
    let userId: string | null = null;
    if (walletAddress) {
      try {
        new PublicKey(walletAddress);
        const user = await prisma.user.findUnique({
          where: { walletAddress },
          select: { id: true }
        });
        userId = user?.id || null;
      } catch {
        // Invalid wallet, continue without user
      }
    }

    // Create play record
    const play = await prisma.play.create({
      data: {
        trackId,
        userId,
        duration: playDuration,
      }
    });

    // Update track and artist play counts atomically to prevent race conditions
    await prisma.$transaction([
      prisma.track.update({
        where: { id: trackId },
        data: { playCount: { increment: 1 } }
      }),
      prisma.artist.update({
        where: { id: track.artistId },
        data: { totalPlays: { increment: 1 } }
      })
    ]);

    // Update global daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailyStats.upsert({
      where: { date: today },
      update: {
        totalPlays: { increment: 1 },
      },
      create: {
        date: today,
        totalPlays: 1,
        uniqueListeners: userId ? 1 : 0,
      }
    });

    return NextResponse.json({ success: true, playId: play.id });
  } catch (error) {
    console.error('POST play error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
