// app/api/notifications/subscribe/route.ts
// Push notification subscription management

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Subscribe to push notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, subscription, preferences } = body;

    if (!userId || !subscription) {
      return NextResponse.json({ 
        error: 'User ID and subscription required' 
      }, { status: 400 });
    }

    // Validate subscription object
    if (!subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ 
        error: 'Invalid subscription format' 
      }, { status: 400 });
    }

    // Store subscription (you'd need to add a PushSubscription model)
    // For now, store in user metadata
    await prisma.user.update({
      where: { id: userId },
      data: {
        // Store as JSON string in a metadata field or create a new model
        bio: JSON.stringify({
          pushSubscription: subscription,
          notificationPreferences: preferences || {
            newReleases: true,
            follows: true,
            likes: true,
            comments: true,
            earnings: true,
          },
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscribed to notifications',
    });

  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

// DELETE - Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        bio: null, // Clear push subscription
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Unsubscribed from notifications',
    });

  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
