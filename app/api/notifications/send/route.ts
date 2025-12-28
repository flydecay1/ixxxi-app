// app/api/notifications/send/route.ts
// Send push notifications (internal/admin use)

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// Configure web-push with VAPID keys
// Generate keys: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@ixxxi.io',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// Notification types
type NotificationType = 
  | 'new_release'
  | 'new_follower'
  | 'track_liked'
  | 'comment'
  | 'earnings'
  | 'early_access'
  | 'system';

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  data?: Record<string, any>;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
}

// POST - Send notification (admin/system only)
export async function POST(request: NextRequest) {
  const adminKey = request.headers.get('x-admin-key');
  
  // Only allow internal calls
  if (adminKey !== process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { subscription, notification } = body as {
      subscription: PushSubscription;
      notification: NotificationPayload;
    };

    if (!subscription || !notification) {
      return NextResponse.json({ 
        error: 'Subscription and notification required' 
      }, { status: 400 });
    }

    // Build notification payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icons/icon-192x192.png',
      url: notification.url || '/',
      data: notification.data,
      tag: notification.tag || notification.type,
      actions: notification.actions || getDefaultActions(notification.type),
    });

    // Send notification
    await webpush.sendNotification(subscription as any, payload);

    return NextResponse.json({
      success: true,
      message: 'Notification sent',
    });

  } catch (error: any) {
    console.error('Send notification error:', error);
    
    // Handle expired subscriptions
    if (error.statusCode === 410) {
      return NextResponse.json({ 
        error: 'Subscription expired',
        shouldRemove: true,
      }, { status: 410 });
    }

    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

// Get default actions based on notification type
function getDefaultActions(type: NotificationType): Array<{ action: string; title: string }> {
  switch (type) {
    case 'new_release':
      return [
        { action: 'play', title: '▶️ Play' },
        { action: 'view', title: 'View' },
      ];
    case 'new_follower':
      return [
        { action: 'view-profile', title: 'View Profile' },
      ];
    case 'track_liked':
    case 'comment':
      return [
        { action: 'view', title: 'View' },
      ];
    case 'earnings':
      return [
        { action: 'view-dashboard', title: 'Dashboard' },
      ];
    case 'early_access':
      return [
        { action: 'listen', title: '🎧 Listen Now' },
      ];
    default:
      return [];
  }
}

// Notification templates
export function createNotification(
  type: NotificationType,
  data: Record<string, any>
): NotificationPayload {
  switch (type) {
    case 'new_release':
      return {
        type,
        title: `🎵 New Release: ${data.trackTitle}`,
        body: `${data.artistName} just dropped "${data.trackTitle}"`,
        url: `/track/${data.trackId}`,
        data: { trackId: data.trackId },
      };

    case 'new_follower':
      return {
        type,
        title: '👤 New Follower',
        body: `${data.followerName} started following you`,
        url: `/profile/${data.followerWallet}`,
        data: { userId: data.followerId },
      };

    case 'track_liked':
      return {
        type,
        title: '❤️ Track Liked',
        body: `${data.userName} liked "${data.trackTitle}"`,
        url: `/track/${data.trackId}`,
        data: { trackId: data.trackId },
      };

    case 'comment':
      return {
        type,
        title: '💬 New Comment',
        body: `${data.userName}: "${data.comment.substring(0, 50)}..."`,
        url: `/track/${data.trackId}`,
        data: { trackId: data.trackId, commentId: data.commentId },
      };

    case 'earnings':
      return {
        type,
        title: '💰 You Earned Revenue',
        body: `You earned ${data.amount} ${data.currency} from "${data.trackTitle}"`,
        url: '/artist/dashboard',
        data: { amount: data.amount },
      };

    case 'early_access':
      return {
        type,
        title: '🎧 Early Access Available',
        body: `As a ${data.tier} member, you can now listen to "${data.trackTitle}"`,
        url: `/track/${data.trackId}`,
        data: { trackId: data.trackId },
      };

    default:
      return {
        type: 'system',
        title: data.title || 'IXXXI',
        body: data.body || '',
        url: data.url || '/',
      };
  }
}
