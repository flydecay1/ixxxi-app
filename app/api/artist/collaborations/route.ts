// app/api/artist/collaborations/route.ts
// Artist collaboration invites and management

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get collaboration invites and active collaborations
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artistId');
  const type = searchParams.get('type') || 'all'; // 'sent' | 'received' | 'active' | 'all'

  if (!artistId) {
    return NextResponse.json({ error: 'Artist ID required' }, { status: 400 });
  }

  try {
    const conditions: any[] = [];

    if (type === 'sent' || type === 'all') {
      conditions.push({ inviterId: artistId });
    }
    if (type === 'received' || type === 'all') {
      conditions.push({ inviteeId: artistId });
    }

    const collaborations = await prisma.collaboration.findMany({
      where: {
        OR: conditions,
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
        invitee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
        track: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Separate by status
    const pending = collaborations.filter(c => c.status === 'pending');
    const active = collaborations.filter(c => c.status === 'accepted');
    const declined = collaborations.filter(c => c.status === 'declined');

    return NextResponse.json({
      pending,
      active,
      declined,
      total: collaborations.length,
    });

  } catch (error) {
    console.error('Get collaborations error:', error);
    return NextResponse.json({ error: 'Failed to get collaborations' }, { status: 500 });
  }
}

// POST - Send collaboration invite
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      inviterId,
      inviteeId,
      trackId,
      message,
      role = 'featured',
      royaltyShare = 50, // Default 50/50 split
    } = body;

    if (!inviterId || !inviteeId) {
      return NextResponse.json({
        error: 'Inviter and invitee artist IDs required',
      }, { status: 400 });
    }

    // Validate artists exist
    const [inviter, invitee] = await Promise.all([
      prisma.artist.findUnique({ where: { id: inviterId } }),
      prisma.artist.findUnique({ where: { id: inviteeId } }),
    ]);

    if (!inviter || !invitee) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Check for existing invite
    const existing = await prisma.collaboration.findFirst({
      where: {
        inviterId,
        inviteeId,
        trackId: trackId || null,
        status: 'pending',
      },
    });

    if (existing) {
      return NextResponse.json({
        error: 'Collaboration invite already pending',
      }, { status: 400 });
    }

    // Create collaboration invite
    const collaboration = await prisma.collaboration.create({
      data: {
        inviterId,
        inviteeId,
        trackId,
        message,
        role,
        royaltyShare,
        status: 'pending',
      },
      include: {
        inviter: {
          select: { name: true, avatarUrl: true },
        },
        invitee: {
          select: { name: true, avatarUrl: true },
        },
      },
    });

    // TODO: Send notification to invitee

    return NextResponse.json({
      success: true,
      collaboration,
      message: `Collaboration invite sent to ${invitee.name}`,
    });

  } catch (error) {
    console.error('Send collab invite error:', error);
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}

// PATCH - Accept/decline collaboration
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      collaborationId,
      artistId,
      action, // 'accept' | 'decline'
      royaltyShare, // Can renegotiate on accept
    } = body;

    if (!collaborationId || !artistId || !action) {
      return NextResponse.json({
        error: 'Collaboration ID, artist ID, and action required',
      }, { status: 400 });
    }

    // Verify this is the invitee
    const collaboration = await prisma.collaboration.findFirst({
      where: {
        id: collaborationId,
        inviteeId: artistId,
        status: 'pending',
      },
      include: {
        track: true,
      },
    });

    if (!collaboration) {
      return NextResponse.json({
        error: 'Collaboration invite not found',
      }, { status: 404 });
    }

    if (action === 'accept') {
      // Update collaboration status
      await prisma.collaboration.update({
        where: { id: collaborationId },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          royaltyShare: royaltyShare || collaboration.royaltyShare,
        },
      });

      // If track exists, update royalty splits
      if (collaboration.trackId && collaboration.track) {
        const invitee = await prisma.artist.findUnique({
          where: { id: artistId },
          select: { wallet: true, name: true },
        });

        const currentSplits = collaboration.track.royaltySplits as any[] || [];
        const newShare = royaltyShare || collaboration.royaltyShare;

        // Add collaborator to royalty splits
        const updatedSplits = [
          ...currentSplits.map(s => ({
            ...s,
            percentage: s.percentage * (1 - newShare / 100), // Reduce existing shares
          })),
          {
            wallet: invitee?.wallet,
            name: invitee?.name,
            percentage: newShare,
            role: collaboration.role,
          },
        ];

        await prisma.track.update({
          where: { id: collaboration.trackId },
          data: {
            royaltySplits: updatedSplits,
          },
        });
      }

      return NextResponse.json({
        success: true,
        status: 'accepted',
        message: 'Collaboration accepted',
      });
    }

    if (action === 'decline') {
      await prisma.collaboration.update({
        where: { id: collaborationId },
        data: {
          status: 'declined',
          declinedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        status: 'declined',
        message: 'Collaboration declined',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Update collaboration error:', error);
    return NextResponse.json({ error: 'Failed to update collaboration' }, { status: 500 });
  }
}

// DELETE - Cancel collaboration invite (inviter only)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { collaborationId, artistId } = body;

    if (!collaborationId || !artistId) {
      return NextResponse.json({
        error: 'Collaboration ID and artist ID required',
      }, { status: 400 });
    }

    // Verify inviter
    const collaboration = await prisma.collaboration.findFirst({
      where: {
        id: collaborationId,
        inviterId: artistId,
        status: 'pending',
      },
    });

    if (!collaboration) {
      return NextResponse.json({
        error: 'Collaboration invite not found',
      }, { status: 404 });
    }

    await prisma.collaboration.delete({
      where: { id: collaborationId },
    });

    return NextResponse.json({
      success: true,
      message: 'Collaboration invite cancelled',
    });

  } catch (error) {
    console.error('Cancel collaboration error:', error);
    return NextResponse.json({ error: 'Failed to cancel collaboration' }, { status: 500 });
  }
}
