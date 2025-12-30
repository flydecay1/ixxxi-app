// app/api/track/play/route.ts
// Track play logging API - record plays for analytics

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { optionalAuth } from '@/lib/middleware/auth';
import { cache } from '@/lib/cache';

// POST - Record a play (with optional authentication)
export async function POST(request: NextRequest) {
  return optionalAuth(request, async (req, auth) => {
    try {
      const body = await req.json();
      const { trackId, duration } = body;

      if (!trackId || duration === undefined) {
        return NextResponse.json({ error: 'trackId and duration required' }, { status: 400 });
      }

      // Validate duration (minimum 30 seconds to count as a play)
      const playDuration = Math.max(0, Math.min(duration, 600)); // Cap at 10 minutes
      if (playDuration < 30) {
        return NextResponse.json({ error: 'Minimum play duration is 30 seconds' }, { status: 400 });
      }

      // Rate limiting using Redis: max 100 plays per hour per user/IP
      const clientId = auth?.userId || req.headers.get('x-forwarded-for') || 'anonymous';
      const rateLimitKey = `play_rate:${clientId}`;

      try {
        const count = await cache.incr(rateLimitKey, 3600); // 1 hour window

        if (count > 100) {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429, headers: { 'Retry-After': '3600' } }
          );
        }
      } catch (error) {
        console.error('Rate limit check error:', error);
        // Fail open if Redis is down
      }

      // Verify track exists
      const track = await prisma.track.findUnique({
        where: { id: trackId }
      });

      if (!track) {
        return NextResponse.json({ error: 'Track not found' }, { status: 404 });
      }

      // Use authenticated user ID if available, otherwise null for anonymous plays
      const userId = auth?.userId || null;

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
  });
}
