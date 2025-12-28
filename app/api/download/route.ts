// app/api/download/route.ts
// Premium offline download API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWalletSignature } from '@/lib/auth';
import { getSignedUrl } from '@/lib/storage';
import { checkTokenBalance } from '@/lib/solana/tokenGate';

// Tier requirements for downloads
const DOWNLOAD_TIER_MINIMUM = 1000; // Premium tier minimum
const MAX_DOWNLOADS_PER_DAY = 50;
const DOWNLOAD_QUALITY_MAP = {
  standard: '320kbps',
  lossless: 'FLAC',
} as const;

// GET - Get user's downloaded tracks list
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    const downloads = await prisma.download.findMany({
      where: { userId },
      include: {
        track: {
          include: {
            artist: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate storage usage (rough estimate)
    const totalSize = downloads.reduce((sum, d) => sum + (d.fileSize || 0), 0);

    return NextResponse.json({
      downloads: downloads.map(d => ({
        id: d.id,
        track: {
          id: d.track.id,
          title: d.track.title,
          ticker: d.track.ticker,
          coverUrl: d.track.coverUrl,
          duration: d.track.duration,
          artist: d.track.artist,
        },
        quality: d.quality,
        fileSize: d.fileSize,
        downloadedAt: d.createdAt,
        expiresAt: d.expiresAt,
      })),
      stats: {
        totalDownloads: downloads.length,
        totalSize,
        formattedSize: formatBytes(totalSize),
      },
    });

  } catch (error) {
    console.error('Get downloads error:', error);
    return NextResponse.json({ error: 'Failed to get downloads' }, { status: 500 });
  }
}

// POST - Request download URL for a track
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, trackId, quality = 'standard', signature, message } = body;

    if (!walletAddress || !trackId) {
      return NextResponse.json({ error: 'Wallet address and track ID required' }, { status: 400 });
    }

    // Verify wallet signature
    if (signature && message) {
      const isValid = await verifyWalletSignature(walletAddress, signature, message);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid wallet signature' }, { status: 401 });
      }
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify token balance for premium tier
    const balance = await checkTokenBalance(walletAddress);
    
    if (balance < DOWNLOAD_TIER_MINIMUM) {
      return NextResponse.json({ 
        error: 'Premium tier required for downloads',
        required: DOWNLOAD_TIER_MINIMUM,
        current: balance,
        message: `You need ${DOWNLOAD_TIER_MINIMUM - balance} more tokens for download access`,
      }, { status: 403 });
    }

    // Check daily download limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const downloadsToday = await prisma.download.count({
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
    });

    if (downloadsToday >= MAX_DOWNLOADS_PER_DAY) {
      return NextResponse.json({ 
        error: 'Daily download limit reached',
        limit: MAX_DOWNLOADS_PER_DAY,
        resetsAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      }, { status: 429 });
    }

    // Get track
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: {
        artist: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Determine quality based on tier
    const isWhale = balance >= 10000;
    const allowedQuality = isWhale || quality === 'standard' ? quality : 'standard';
    
    if (quality === 'lossless' && !isWhale) {
      return NextResponse.json({ 
        error: 'Lossless downloads require Whale tier (10,000+ tokens)',
        current: balance,
        required: 10000,
      }, { status: 403 });
    }

    // Get appropriate audio file URL
    const audioKey = allowedQuality === 'lossless' && track.losslessUrl 
      ? track.losslessUrl 
      : track.audioUrl;

    if (!audioKey) {
      return NextResponse.json({ error: 'Audio file not available' }, { status: 404 });
    }

    // Generate signed download URL (valid for 24 hours)
    const expiresIn = 24 * 60 * 60; // 24 hours
    const downloadUrl = await getSignedUrl(audioKey, expiresIn);

    // Calculate estimated file size
    const bitrate = allowedQuality === 'lossless' ? 1411000 : 320000;
    const estimatedSize = track.duration ? Math.ceil((track.duration * bitrate) / 8) : 0;

    // Record download
    const download = await prisma.download.create({
      data: {
        userId: user.id,
        trackId: track.id,
        quality: DOWNLOAD_QUALITY_MAP[allowedQuality as keyof typeof DOWNLOAD_QUALITY_MAP],
        fileSize: estimatedSize,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    return NextResponse.json({
      downloadUrl,
      download: {
        id: download.id,
        quality: download.quality,
        expiresAt: download.expiresAt,
        fileSize: estimatedSize,
        formattedSize: formatBytes(estimatedSize),
      },
      track: {
        id: track.id,
        title: track.title,
        ticker: track.ticker,
        artist: track.artist.name,
      },
      remaining: MAX_DOWNLOADS_PER_DAY - downloadsToday - 1,
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to generate download' }, { status: 500 });
  }
}

// DELETE - Remove a downloaded track from history
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, downloadId } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (downloadId) {
      // Delete specific download
      await prisma.download.delete({
        where: { 
          id: downloadId,
          userId: user.id,
        },
      });
    } else {
      // Clear all downloads
      await prisma.download.deleteMany({
        where: { userId: user.id },
      });
    }

    return NextResponse.json({ 
      success: true,
      message: downloadId ? 'Download removed' : 'All downloads cleared',
    });

  } catch (error) {
    console.error('Delete download error:', error);
    return NextResponse.json({ error: 'Failed to delete download' }, { status: 500 });
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
