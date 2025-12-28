// app/api/track/[id]/lyrics/route.ts
// Lyrics API - synced lyrics for tracks

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface LyricLine {
  time: number;      // Start time in seconds
  duration?: number; // Line duration in seconds
  text: string;      // Lyric text
}

interface LyricsData {
  trackId: string;
  format: 'plain' | 'synced' | 'word-synced';
  language: string;
  lines: LyricLine[];
  translation?: {
    language: string;
    lines: LyricLine[];
  };
  credits?: {
    writer?: string;
    source?: string;
  };
}

// GET - Get lyrics for a track
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const trackId = params.id;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'synced';
  const lang = searchParams.get('lang');

  try {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      select: {
        id: true,
        title: true,
        lyrics: true,
        lyricsData: true,
        artist: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Parse stored lyrics data
    let lyricsData: LyricsData | null = null;
    
    if (track.lyricsData) {
      try {
        lyricsData = JSON.parse(track.lyricsData);
      } catch {
        // Invalid JSON, use plain lyrics
      }
    }

    // If no synced lyrics, return plain text
    if (!lyricsData && track.lyrics) {
      return NextResponse.json({
        trackId,
        format: 'plain',
        language: 'en',
        lines: track.lyrics.split('\n').map((text, i) => ({
          time: 0,
          text,
        })),
      });
    }

    if (!lyricsData) {
      return NextResponse.json({ 
        error: 'No lyrics available' 
      }, { status: 404 });
    }

    // If translation requested
    if (lang && lyricsData.translation?.language === lang) {
      return NextResponse.json({
        ...lyricsData,
        lines: lyricsData.translation.lines,
        language: lang,
        isTranslation: true,
      });
    }

    return NextResponse.json(lyricsData);

  } catch (error) {
    console.error('Get lyrics error:', error);
    return NextResponse.json({ error: 'Failed to get lyrics' }, { status: 500 });
  }
}

// POST - Add/update lyrics for a track (artist only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const trackId = params.id;
  
  try {
    const body = await request.json();
    const { 
      artistId, 
      lines, 
      format = 'synced',
      language = 'en',
      translation,
      credits,
    } = body;

    if (!artistId) {
      return NextResponse.json({ error: 'Artist ID required' }, { status: 400 });
    }

    // Verify track ownership
    const track = await prisma.track.findFirst({
      where: {
        id: trackId,
        artistId,
      },
    });

    if (!track) {
      return NextResponse.json({ 
        error: 'Track not found or not owned by artist' 
      }, { status: 404 });
    }

    // Validate lyrics format
    if (!lines || !Array.isArray(lines)) {
      return NextResponse.json({ 
        error: 'Lyrics lines array required' 
      }, { status: 400 });
    }

    // Validate each line
    for (const line of lines) {
      if (typeof line.text !== 'string') {
        return NextResponse.json({ 
          error: 'Each line must have text' 
        }, { status: 400 });
      }
      if (format === 'synced' && typeof line.time !== 'number') {
        return NextResponse.json({ 
          error: 'Synced lyrics require time for each line' 
        }, { status: 400 });
      }
    }

    const lyricsData: LyricsData = {
      trackId,
      format,
      language,
      lines,
      translation,
      credits,
    };

    // Update track with lyrics
    await prisma.track.update({
      where: { id: trackId },
      data: {
        lyrics: lines.map(l => l.text).join('\n'),
        lyricsData: JSON.stringify(lyricsData),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Lyrics updated',
      format,
      lineCount: lines.length,
    });

  } catch (error) {
    console.error('Update lyrics error:', error);
    return NextResponse.json({ error: 'Failed to update lyrics' }, { status: 500 });
  }
}

// DELETE - Remove lyrics
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const trackId = params.id;
  
  try {
    const body = await request.json();
    const { artistId } = body;

    if (!artistId) {
      return NextResponse.json({ error: 'Artist ID required' }, { status: 400 });
    }

    // Verify track ownership
    const track = await prisma.track.findFirst({
      where: {
        id: trackId,
        artistId,
      },
    });

    if (!track) {
      return NextResponse.json({ 
        error: 'Track not found or not owned by artist' 
      }, { status: 404 });
    }

    await prisma.track.update({
      where: { id: trackId },
      data: {
        lyrics: null,
        lyricsData: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Lyrics removed',
    });

  } catch (error) {
    console.error('Delete lyrics error:', error);
    return NextResponse.json({ error: 'Failed to delete lyrics' }, { status: 500 });
  }
}
