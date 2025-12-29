// app/api/health/route.ts
// Comprehensive health check endpoint

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ServiceHealth;
    storage: ServiceHealth;
    api: ServiceHealth;
  };
  metrics?: {
    responseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    activeConnections?: number;
  };
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';
  const checkStart = Date.now();

  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.6.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: { status: 'up' },
      storage: { status: 'up' },
      api: { status: 'up' },
    },
  };

  // Database health check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'up',
      latency: Date.now() - dbStart,
    };
  } catch (error: any) {
    health.checks.database = {
      status: 'down',
      message: error.message,
    };
    health.status = 'unhealthy';
  }

  // Storage health check (R2)
  try {
    const storageStart = Date.now();
    // Check if R2 env vars are configured
    const r2Configured = !!(
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
    );
    
    health.checks.storage = {
      status: r2Configured ? 'up' : 'degraded',
      latency: Date.now() - storageStart,
      message: r2Configured ? undefined : 'R2 not fully configured',
    };

    if (!r2Configured && health.status === 'healthy') {
      health.status = 'degraded';
    }
  } catch (error: any) {
    health.checks.storage = {
      status: 'down',
      message: error.message,
    };
    health.status = 'unhealthy';
  }

  // API self-check
  health.checks.api = {
    status: 'up',
    latency: Date.now() - checkStart,
  };

  // Add detailed metrics if requested
  if (detailed) {
    health.metrics = {
      responseTime: Date.now() - checkStart,
      memoryUsage: process.memoryUsage(),
    };

    // Add database stats
    try {
      const [userCount, trackCount, playCount] = await Promise.all([
        prisma.user.count(),
        prisma.track.count(),
        prisma.play.count(),
      ]);

      (health.metrics as any).stats = {
        users: userCount,
        tracks: trackCount,
        plays: playCount,
      };
    } catch {
      // Ignore stats errors
    }
  }

  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 
    : health.status === 'degraded' ? 200 
    : 503;

  return NextResponse.json(health, { status: statusCode });
}

// POST - Run diagnostic checks (admin only)
export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: await runDatabaseDiagnostics(),
      recentErrors: await getRecentErrors(),
      pendingJobs: await getPendingJobs(),
    };

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function runDatabaseDiagnostics() {
  try {
    const [
      userCount,
      artistCount,
      trackCount,
      playCount,
      purchaseCount,
      failedTracks,
      pendingPurchases,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.artist.count(),
      prisma.track.count(),
      prisma.play.count(),
      prisma.purchase.count(),
      prisma.track.count({ where: { status: 'failed' } }),
      prisma.purchase.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      status: 'connected',
      counts: {
        users: userCount,
        artists: artistCount,
        tracks: trackCount,
        plays: playCount,
        purchases: purchaseCount,
      },
      issues: {
        failedTracks,
        pendingPurchases,
      },
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message,
    };
  }
}

async function getRecentErrors() {
  try {
    const recentFailures = await prisma.track.findMany({
      where: {
        processingError: { not: null },
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        title: true,
        processingError: true,
        updatedAt: true,
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      count: recentFailures.length,
      recent: recentFailures,
    };
  } catch {
    return { count: 0, recent: [] };
  }
}

async function getPendingJobs() {
  try {
    const [processingTracks, pendingPurchases] = await Promise.all([
      prisma.track.count({ where: { status: 'processing' } }),
      prisma.purchase.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      processingTracks,
      pendingPurchases,
    };
  } catch {
    return { processingTracks: 0, pendingPurchases: 0 };
  }
}
