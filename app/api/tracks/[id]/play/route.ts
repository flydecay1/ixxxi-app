// app/api/tracks/[id]/play/route.ts
// Track play recording endpoint

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Record a play
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { walletAddress, duration, completed, source } = body;
    
    // Get track
    const track = await prisma.track.findUnique({
      where: { id: params.id },
    });
    
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    
    // Get user if wallet provided
    let userId: string | null = null;
    if (walletAddress) {
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        select: { id: true },
      });
      userId = user?.id || null;
    }
    
    // Get region from request (simplified)
    const region = req.headers.get('cf-ipcountry') || 
                   req.headers.get('x-vercel-ip-country') || 
                   'UNKNOWN';
    
    // Create play record
    const play = await prisma.play.create({
      data: {
        trackId: params.id,
        userId,
        duration: duration || 0,
        completed: completed || false,
        source: source || 'direct',
        region,
      },
    });
    
    // Update track play count
    await prisma.track.update({
      where: { id: params.id },
      data: {
        playCount: { increment: 1 },
        // Update unique plays only if user is known
        ...(userId ? { uniquePlays: { increment: 1 } } : {}),
      },
    });
    
    // Update artist play count
    await prisma.artist.update({
      where: { id: track.artistId },
      data: { totalPlays: { increment: 1 } },
    });
    
    // Update user play count if logged in
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { totalPlays: { increment: 1 } },
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      playId: play.id,
    });
    
  } catch (error) {
    console.error('Play recording error:', error);
    return NextResponse.json({ error: 'Failed to record play' }, { status: 500 });
  }
}

// PATCH: Update play (for tracking duration/completion)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { playId, duration, completed } = body;
    
    if (!playId) {
      return NextResponse.json({ error: 'playId required' }, { status: 400 });
    }
    
    const play = await prisma.play.update({
      where: { id: playId },
      data: {
        duration: duration || undefined,
        completed: completed || undefined,
      },
    });
    
    return NextResponse.json({ success: true, play });
    
  } catch (error) {
    console.error('Play update error:', error);
    return NextResponse.json({ error: 'Failed to update play' }, { status: 500 });
  }
}
