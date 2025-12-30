// app/api/stream/[token]/route.ts
// Protected content streaming endpoint with DRM

import { NextRequest, NextResponse } from 'next/server';
import { 
  verifySignedUrl, 
  checkStreamRateLimit, 
  detectSuspiciousBehavior,
  generateWatermark 
} from '@/lib/drm/contentProtection';
import { prisma } from '@/lib/prisma';

// Block common ripping tools user agents
const BLOCKED_USER_AGENTS = [
  'youtube-dl',
  'yt-dlp', 
  'ffmpeg',
  'wget',
  'curl',
  'aria2',
  'streamripper',
  'audacity',
  'freemake',
  'any-video-converter',
  'clipgrab',
];

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  
  // 1. Check user agent for known ripping tools
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (userAgent.includes(blocked)) {
      return new NextResponse('Access denied', { status: 403 });
    }
  }
  
  // 2. Verify the signed URL
  const verification = verifySignedUrl(token);
  if (!verification.valid || !verification.params) {
    return NextResponse.json(
      { error: verification.error || 'Invalid access token' },
      { status: 401 }
    );
  }
  
  const { contentId, userId, contentType, quality } = verification.params;
  
  // 3. Rate limiting
  const rateLimit = await checkStreamRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }
  
  // 4. Get content from database
  const track = await prisma.track.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      audioUrl: true,
      duration: true,
      gateType: true,
      gateTokenMint: true,
      gateTokenAmount: true,
      status: true,
    }
  });
  
  if (!track || track.status !== 'published') {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }
  
  // 5. Generate watermark for this user/track combination
  const watermark = generateWatermark(userId, contentId);
  
  // 6. Return encrypted HLS manifest or direct stream based on type
  // In production, this would generate an encrypted HLS stream
  // For now, we return headers that prevent easy downloading
  
  const headers = new Headers({
    // Prevent caching
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    
    // Prevent embedding
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'",
    
    // Watermark header (for logging/tracking)
    'X-Content-Watermark': watermark,
    
    // Prevent range requests (makes downloading harder)
    // In production, you'd want to carefully manage this
    'Accept-Ranges': 'none',
  });
  
  // In a real implementation, you would:
  // 1. Fetch the audio from IPFS/S3
  // 2. Encrypt it with HLS AES-128
  // 3. Embed watermark in audio
  // 4. Stream it chunk by chunk
  
  // For demo, redirect to the actual audio URL with short TTL
  // The frontend player should request new URLs frequently
  
  return NextResponse.json({
    streamUrl: track.audioUrl,
    watermark,
    expiresIn: 30,
    // HLS manifest would go here in production
    manifest: null,
  }, { headers });
}

// POST for reporting playback duration (anti-rip detection)
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { duration } = await request.json();
    const verification = verifySignedUrl(params.token);
    
    if (!verification.valid || !verification.params) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const { contentId, userId } = verification.params;
    
    // Check for suspicious behavior
    const behavior = await detectSuspiciousBehavior(userId, contentId, duration);

    if (behavior.suspicious) {
      // Log suspicious activity
      console.warn(`[DRM] Suspicious activity from user ${userId}: ${behavior.reason}`);

      // Could trigger additional verification, rate limiting, or account review
      // For now, just log it
    }
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
