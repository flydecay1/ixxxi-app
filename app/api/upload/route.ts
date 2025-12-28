// app/api/upload/route.ts
// Audio file upload endpoint for artists

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadFile, generateStorageKey, isStorageConfigured } from '@/lib/storage';

// Allowed audio formats
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',      // MP3
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/mp4',
];

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB

// POST: Upload a new track
export async function POST(req: NextRequest) {
  try {
    // Check storage configuration
    if (!isStorageConfigured()) {
      // In development, return mock response
      console.log('Storage not configured, using mock response');
      return NextResponse.json({
        success: true,
        message: 'Track created (storage not configured - dev mode)',
        track: {
          id: 'mock-' + Date.now(),
          status: 'ready',
        },
      });
    }

    // Get form data
    const formData = await req.formData();
    
    const walletAddress = formData.get('walletAddress') as string;
    const audioFile = formData.get('audio') as File | null;
    const coverFile = formData.get('cover') as File | null;
    const title = formData.get('title') as string;
    const ticker = formData.get('ticker') as string;
    const description = formData.get('description') as string | null;
    const genre = formData.get('genre') as string | null;
    const region = formData.get('region') as string | null;
    const latitude = formData.get('latitude') as string | null;
    const longitude = formData.get('longitude') as string | null;
    const gateType = (formData.get('gateType') as string) || 'none';
    const gateTokenMint = formData.get('gateTokenMint') as string | null;
    const gateTokenAmount = formData.get('gateTokenAmount') as string | null;
    const priceSOL = formData.get('priceSOL') as string | null;

    // Validate required fields
    if (!walletAddress || !audioFile || !title || !ticker) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, audio, title, ticker' },
        { status: 400 }
      );
    }

    // Validate audio file
    if (!ALLOWED_AUDIO_TYPES.includes(audioFile.type)) {
      return NextResponse.json(
        { error: `Invalid audio format. Allowed: MP3, WAV, FLAC, AAC` },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: `Audio file too large. Maximum: 100MB` },
        { status: 400 }
      );
    }

    // Validate cover if provided
    if (coverFile && !ALLOWED_IMAGE_TYPES.includes(coverFile.type)) {
      return NextResponse.json(
        { error: `Invalid image format. Allowed: JPEG, PNG, WebP` },
        { status: 400 }
      );
    }

    if (coverFile && coverFile.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `Cover image too large. Maximum: 10MB` },
        { status: 400 }
      );
    }

    // Get user and verify they're an artist
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.artist) {
      return NextResponse.json({ error: 'Must be an artist to upload tracks' }, { status: 403 });
    }

    // Create track record first (status: processing)
    const track = await prisma.track.create({
      data: {
        artistId: user.artist.id,
        title,
        ticker: ticker.startsWith('$') ? ticker : `$${ticker}`,
        description,
        genre,
        region,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        gateType,
        gateTokenMint,
        gateTokenAmount: gateTokenAmount ? parseFloat(gateTokenAmount) : null,
        priceSOL: priceSOL ? parseFloat(priceSOL) : null,
        status: 'processing',
      },
    });

    try {
      // Upload audio file
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      const audioExt = audioFile.type.includes('wav') ? 'wav' 
        : audioFile.type.includes('flac') ? 'flac' 
        : 'mp3';
      
      const audioKey = generateStorageKey(user.artist.id, track.id, 'audio', audioExt);
      const audioResult = await uploadFile(audioKey, audioBuffer, audioFile.type);

      // Upload cover if provided
      let coverResult = null;
      if (coverFile) {
        const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
        const coverExt = coverFile.type.includes('png') ? 'png' 
          : coverFile.type.includes('webp') ? 'webp' 
          : 'jpg';
        
        const coverKey = generateStorageKey(user.artist.id, track.id, 'cover', coverExt);
        coverResult = await uploadFile(coverKey, coverBuffer, coverFile.type);
      }

      // Update track with URLs
      const updatedTrack = await prisma.track.update({
        where: { id: track.id },
        data: {
          audioKey: audioResult.key,
          audioUrl: audioResult.url,
          audioFormat: audioExt,
          audioSize: audioResult.size,
          coverKey: coverResult?.key,
          coverUrl: coverResult?.url,
          status: 'ready', // Would be 'processing' if we had transcoding
        },
      });

      // Update artist track count
      await prisma.artist.update({
        where: { id: user.artist.id },
        data: { totalTracks: { increment: 1 } },
      });

      return NextResponse.json({
        success: true,
        track: {
          id: updatedTrack.id,
          title: updatedTrack.title,
          ticker: updatedTrack.ticker,
          audioUrl: updatedTrack.audioUrl,
          coverUrl: updatedTrack.coverUrl,
          status: updatedTrack.status,
        },
      });

    } catch (uploadError) {
      // Mark track as failed if upload fails
      await prisma.track.update({
        where: { id: track.id },
        data: { 
          status: 'failed',
          processingError: uploadError instanceof Error ? uploadError.message : 'Upload failed',
        },
      });
      throw uploadError;
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

// GET: Get presigned upload URL (for client-side uploads)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    const type = searchParams.get('type') as 'audio' | 'cover';
    const filename = searchParams.get('filename');
    const contentType = searchParams.get('contentType');

    if (!walletAddress || !type || !filename || !contentType) {
      return NextResponse.json(
        { error: 'Missing required params: walletAddress, type, filename, contentType' },
        { status: 400 }
      );
    }

    // Verify user is an artist
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true },
    });

    if (!user?.artist) {
      return NextResponse.json({ error: 'Must be an artist' }, { status: 403 });
    }

    // In dev mode without storage, return mock
    if (!isStorageConfigured()) {
      return NextResponse.json({
        uploadUrl: 'mock://upload',
        key: `mock-${Date.now()}`,
        publicUrl: 'https://placehold.co/400x400',
      });
    }

    // Generate presigned URL
    const { getUploadPresignedUrl } = await import('@/lib/storage');
    const ext = filename.split('.').pop() || 'bin';
    const key = generateStorageKey(user.artist.id, 'pending', type, ext);
    const uploadUrl = await getUploadPresignedUrl(key, contentType);

    return NextResponse.json({
      uploadUrl,
      key,
    });

  } catch (error) {
    console.error('Presigned URL error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
