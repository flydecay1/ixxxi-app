// app/api/cron/cleanup/route.ts
// Cron job to clean up old data and maintain database hygiene

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CRON_SECRET = process.env.CRON_SECRET;

// Data retention periods (in days)
const RETENTION = {
  expiredDownloads: 7,      // Remove download records older than 7 days
  oldPlays: 90,             // Archive play data older than 90 days
  pendingPurchases: 1,      // Expire pending purchases after 24 hours
  failedTracks: 30,         // Clean up failed track records after 30 days
  orphanedFiles: 7,         // Flag orphaned storage files after 7 days
};

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const results: Record<string, any> = {};

  try {
    // 1. Clean up expired download records
    const expiredDownloadDate = new Date();
    expiredDownloadDate.setDate(expiredDownloadDate.getDate() - RETENTION.expiredDownloads);

    const deletedDownloads = await prisma.download.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    results.expiredDownloads = deletedDownloads.count;

    // 2. Expire pending purchases older than 24 hours
    const expiredPurchaseDate = new Date();
    expiredPurchaseDate.setDate(expiredPurchaseDate.getDate() - RETENTION.pendingPurchases);

    const expiredPurchases = await prisma.purchase.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: expiredPurchaseDate },
      },
      data: {
        status: 'FAILED',
      },
    });
    results.expiredPurchases = expiredPurchases.count;

    // 3. Clean up failed tracks older than 30 days
    const failedTrackDate = new Date();
    failedTrackDate.setDate(failedTrackDate.getDate() - RETENTION.failedTracks);

    const deletedFailedTracks = await prisma.track.deleteMany({
      where: {
        status: 'failed',
        createdAt: { lt: failedTrackDate },
      },
    });
    results.deletedFailedTracks = deletedFailedTracks.count;

    // 4. Update user last seen timestamps (for active users)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Get users with recent plays
    const recentActivePlays = await prisma.play.findMany({
      where: {
        createdAt: { gte: fiveMinutesAgo },
        userId: { not: null },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const activeUserIds = recentActivePlays
      .map(p => p.userId)
      .filter(Boolean) as string[];

    if (activeUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: activeUserIds } },
        data: { lastSeenAt: new Date() },
      });
    }
    results.activeUsersUpdated = activeUserIds.length;

    // 5. Recalculate track play counts
    const tracks = await prisma.track.findMany({
      select: { id: true },
    });

    let tracksUpdated = 0;
    for (const track of tracks) {
      const [playCount, likeCount] = await Promise.all([
        prisma.play.count({ where: { trackId: track.id } }),
        prisma.like.count({ where: { trackId: track.id } }),
      ]);

      await prisma.track.update({
        where: { id: track.id },
        data: { playCount, likeCount },
      });
      tracksUpdated++;
    }
    results.trackCountsRecalculated = tracksUpdated;

    // 6. Clean up orphaned playlist tracks
    const deletedPlaylistTracks = await prisma.playlistTrack.deleteMany({
      where: {
        track: null, // Track was deleted
      },
    });
    results.orphanedPlaylistTracks = deletedPlaylistTracks.count;

    // 7. Update user total plays
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    let usersUpdated = 0;
    for (const user of users) {
      const totalPlays = await prisma.play.count({
        where: { userId: user.id },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { totalPlays },
      });
      usersUpdated++;
    }
    results.userStatsUpdated = usersUpdated;

    // Calculate duration
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      results,
    });

  } catch (error: any) {
    console.error('Cleanup cron error:', error);
    return NextResponse.json({ 
      error: 'Cleanup failed',
      message: error.message,
      partialResults: results,
    }, { status: 500 });
  }
}
