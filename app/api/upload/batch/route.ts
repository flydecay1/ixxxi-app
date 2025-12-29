// app/api/upload/batch/route.ts
// Batch upload for albums and EPs

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadToR2, generateSignedUrl } from '@/lib/storage';

interface TrackUpload {
  title: string;
  trackNumber: number;
  duration?: number;
  genre?: string;
  bpm?: number;
  file?: {
    name: string;
    size: number;
    type: string;
  };
}

interface BatchUploadRequest {
  artistId: string;
  albumTitle: string;
  albumType: 'album' | 'ep' | 'single' | 'compilation';
  releaseDate?: string;
  coverUrl?: string;
  genre?: string;
  description?: string;
  tracks: TrackUpload[];
  // Token gating
  gateType?: string;
  gateTokenMint?: string;
  gateTokenAmount?: number;
  priceSOL?: number;
}

// POST - Initialize batch upload
export async function POST(request: NextRequest) {
  try {
    const body: BatchUploadRequest = await request.json();
    const {
      artistId,
      albumTitle,
      albumType,
      releaseDate,
      coverUrl,
      genre,
      description,
      tracks,
      gateType,
      gateTokenMint,
      gateTokenAmount,
      priceSOL,
    } = body;

    if (!artistId || !albumTitle || !tracks?.length) {
      return NextResponse.json({
        error: 'Artist ID, album title, and tracks required',
      }, { status: 400 });
    }

    // Verify artist
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Create album/release record
    const release = await prisma.release.create({
      data: {
        artistId,
        title: albumTitle,
        type: albumType,
        description,
        coverUrl,
        genre,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        trackCount: tracks.length,
        status: 'draft',
      },
    });

    // Generate upload URLs for each track
    const uploadUrls = await Promise.all(
      tracks.map(async (track, index) => {
        const trackNumber = track.trackNumber || index + 1;
        const key = `artists/${artistId}/releases/${release.id}/track-${trackNumber}`;
        
        // Create track record
        const dbTrack = await prisma.track.create({
          data: {
            artistId,
            title: track.title,
            ticker: `$${albumTitle.substring(0, 4).toUpperCase()}-${trackNumber}`,
            genre: track.genre || genre,
            bpm: track.bpm,
            duration: track.duration,
            releaseId: release.id,
            trackNumber,
            status: 'processing',
            gateType: gateType || 'none',
            gateTokenMint,
            gateTokenAmount,
            priceSOL,
          },
        });

        // Generate signed upload URL
        const uploadUrl = await generateSignedUrl(key, 'PUT', 3600);

        return {
          trackId: dbTrack.id,
          trackNumber,
          title: track.title,
          uploadUrl,
          key,
        };
      })
    );

    // Update artist track count
    await prisma.artist.update({
      where: { id: artistId },
      data: {
        totalTracks: { increment: tracks.length },
      },
    });

    return NextResponse.json({
      success: true,
      releaseId: release.id,
      albumTitle,
      trackCount: tracks.length,
      uploads: uploadUrls,
      message: `Upload ${tracks.length} tracks to complete the release`,
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json({ error: 'Batch upload failed' }, { status: 500 });
  }
}

// PATCH - Confirm batch upload completion
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { releaseId, artistId, completedTracks } = body;

    if (!releaseId || !artistId) {
      return NextResponse.json({
        error: 'Release ID and artist ID required',
      }, { status: 400 });
    }

    // Verify ownership
    const release = await prisma.release.findFirst({
      where: { id: releaseId, artistId },
      include: { tracks: true },
    });

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    // Update completed tracks
    if (completedTracks?.length) {
      await Promise.all(
        completedTracks.map(async (track: { trackId: string; audioKey: string; audioUrl: string }) => {
          await prisma.track.update({
            where: { id: track.trackId },
            data: {
              audioKey: track.audioKey,
              audioUrl: track.audioUrl,
              status: 'ready',
            },
          });
        })
      );
    }

    // Check if all tracks are ready
    const readyTracks = await prisma.track.count({
      where: { releaseId, status: 'ready' },
    });

    const allReady = readyTracks === release.trackCount;

    // Update release status
    await prisma.release.update({
      where: { id: releaseId },
      data: {
        status: allReady ? 'ready' : 'processing',
        uploadedAt: allReady ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      releaseId,
      readyTracks,
      totalTracks: release.trackCount,
      allReady,
      status: allReady ? 'ready' : 'processing',
    });

  } catch (error) {
    console.error('Batch confirm error:', error);
    return NextResponse.json({ error: 'Failed to confirm upload' }, { status: 500 });
  }
}

// GET - Get batch upload status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const releaseId = searchParams.get('releaseId');
  const artistId = searchParams.get('artistId');

  if (!releaseId || !artistId) {
    return NextResponse.json({
      error: 'Release ID and artist ID required',
    }, { status: 400 });
  }

  try {
    const release = await prisma.release.findFirst({
      where: { id: releaseId, artistId },
      include: {
        tracks: {
          orderBy: { trackNumber: 'asc' },
          select: {
            id: true,
            title: true,
            trackNumber: true,
            status: true,
            duration: true,
            audioUrl: true,
          },
        },
      },
    });

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    return NextResponse.json({
      releaseId: release.id,
      title: release.title,
      type: release.type,
      status: release.status,
      trackCount: release.trackCount,
      tracks: release.tracks,
      coverUrl: release.coverUrl,
      releaseDate: release.releaseDate,
    });

  } catch (error) {
    console.error('Get batch status error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
