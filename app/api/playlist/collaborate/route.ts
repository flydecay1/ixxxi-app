// app/api/playlist/collaborate/route.ts
// Collaborative playlists - invite collaborators, shared editing

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get playlist collaborators
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('playlistId');

  if (!playlistId) {
    return NextResponse.json({ error: 'Playlist ID required' }, { status: 400 });
  }

  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    return NextResponse.json({
      playlistId,
      owner: playlist.user,
      isCollaborative: playlist.isCollaborative,
      collaborators: playlist.collaborators.map(c => ({
        id: c.id,
        user: c.user,
        role: c.role,
        canAdd: c.canAdd,
        canRemove: c.canRemove,
        canReorder: c.canReorder,
        addedAt: c.createdAt,
      })),
    });

  } catch (error) {
    console.error('Get collaborators error:', error);
    return NextResponse.json({ error: 'Failed to get collaborators' }, { status: 500 });
  }
}

// POST - Invite collaborator
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      playlistId,
      ownerId,
      inviteeId,
      role = 'collaborator',
      canAdd = true,
      canRemove = false,
      canReorder = true,
    } = body;

    if (!playlistId || !ownerId || !inviteeId) {
      return NextResponse.json({
        error: 'Playlist ID, owner ID, and invitee ID required',
      }, { status: 400 });
    }

    // Verify ownership
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: ownerId },
    });

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found or not owned' }, { status: 404 });
    }

    // Check if already a collaborator
    const existing = await prisma.playlistCollaborator.findFirst({
      where: { playlistId, userId: inviteeId },
    });

    if (existing) {
      return NextResponse.json({ error: 'User is already a collaborator' }, { status: 400 });
    }

    // Make playlist collaborative if not already
    if (!playlist.isCollaborative) {
      await prisma.playlist.update({
        where: { id: playlistId },
        data: { isCollaborative: true },
      });
    }

    // Add collaborator
    const collaborator = await prisma.playlistCollaborator.create({
      data: {
        playlistId,
        userId: inviteeId,
        role,
        canAdd,
        canRemove,
        canReorder,
      },
      include: {
        user: {
          select: { username: true, avatarUrl: true },
        },
      },
    });

    // Notify invitee
    await prisma.notification.create({
      data: {
        userId: inviteeId,
        type: 'playlist_invite',
        title: 'Playlist Collaboration Invite',
        message: `You've been invited to collaborate on "${playlist.name}"`,
        data: JSON.stringify({ playlistId, playlistName: playlist.name }),
      },
    });

    return NextResponse.json({
      success: true,
      collaborator,
    });

  } catch (error) {
    console.error('Invite collaborator error:', error);
    return NextResponse.json({ error: 'Failed to invite collaborator' }, { status: 500 });
  }
}

// PATCH - Update collaborator permissions
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      playlistId,
      ownerId,
      collaboratorId,
      canAdd,
      canRemove,
      canReorder,
      role,
    } = body;

    if (!playlistId || !ownerId || !collaboratorId) {
      return NextResponse.json({
        error: 'Playlist ID, owner ID, and collaborator ID required',
      }, { status: 400 });
    }

    // Verify ownership
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId: ownerId },
    });

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found or not owned' }, { status: 404 });
    }

    const updated = await prisma.playlistCollaborator.update({
      where: { id: collaboratorId },
      data: {
        ...(canAdd !== undefined && { canAdd }),
        ...(canRemove !== undefined && { canRemove }),
        ...(canReorder !== undefined && { canReorder }),
        ...(role && { role }),
      },
    });

    return NextResponse.json({
      success: true,
      collaborator: updated,
    });

  } catch (error) {
    console.error('Update collaborator error:', error);
    return NextResponse.json({ error: 'Failed to update collaborator' }, { status: 500 });
  }
}

// DELETE - Remove collaborator or leave playlist
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { playlistId, userId, collaboratorUserId } = body;

    if (!playlistId || !userId) {
      return NextResponse.json({
        error: 'Playlist ID and user ID required',
      }, { status: 400 });
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    // If owner is removing a collaborator
    if (playlist.userId === userId && collaboratorUserId) {
      await prisma.playlistCollaborator.deleteMany({
        where: { playlistId, userId: collaboratorUserId },
      });

      return NextResponse.json({
        success: true,
        message: 'Collaborator removed',
      });
    }

    // If collaborator is leaving
    if (playlist.userId !== userId) {
      await prisma.playlistCollaborator.deleteMany({
        where: { playlistId, userId },
      });

      return NextResponse.json({
        success: true,
        message: 'Left playlist',
      });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });

  } catch (error) {
    console.error('Remove collaborator error:', error);
    return NextResponse.json({ error: 'Failed to remove collaborator' }, { status: 500 });
  }
}
