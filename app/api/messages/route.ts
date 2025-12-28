// app/api/messages/route.ts
// Artist-to-fan messaging system

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Get conversations/messages
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const conversationId = searchParams.get('conversationId');
  const type = searchParams.get('type') || 'inbox'; // 'inbox' | 'sent' | 'conversation'

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    if (conversationId) {
      // Get specific conversation messages
      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              artist: {
                select: {
                  id: true,
                  name: true,
                  isVerified: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Mark as read
      await prisma.message.updateMany({
        where: {
          conversationId,
          recipientId: userId,
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      return NextResponse.json({ messages });
    }

    // Get conversations list
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                artist: {
                  select: {
                    id: true,
                    name: true,
                    isVerified: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
            readAt: true,
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                recipientId: userId,
                readAt: null,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedConversations = conversations.map(c => ({
      id: c.id,
      participants: c.participants
        .filter(p => p.userId !== userId)
        .map(p => ({
          id: p.user.id,
          username: p.user.username,
          avatarUrl: p.user.avatarUrl,
          artistName: p.user.artist?.name,
          isVerified: p.user.artist?.isVerified || false,
        })),
      lastMessage: c.messages[0] || null,
      unreadCount: c._count.messages,
      updatedAt: c.updatedAt,
    }));

    return NextResponse.json({ conversations: formattedConversations });

  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

// POST - Send a message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, recipientId, content, type = 'direct' } = body;

    if (!senderId || !recipientId || !content) {
      return NextResponse.json({ 
        error: 'Sender, recipient, and content required' 
      }, { status: 400 });
    }

    // Validate content length
    if (content.length > 2000) {
      return NextResponse.json({ 
        error: 'Message too long (max 2000 characters)' 
      }, { status: 400 });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        type,
        AND: [
          { participants: { some: { userId: senderId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          type,
          participants: {
            create: [
              { userId: senderId },
              { userId: recipientId },
            ],
          },
        },
      });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        recipientId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // TODO: Send push notification to recipient

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        sender: message.sender,
        createdAt: message.createdAt,
      },
      conversationId: conversation.id,
    });

  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

// PATCH - Mark messages as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, conversationId, messageIds } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const where: any = {
      recipientId: userId,
      readAt: null,
    };

    if (conversationId) {
      where.conversationId = conversationId;
    }

    if (messageIds?.length) {
      where.id = { in: messageIds };
    }

    const updated = await prisma.message.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      markedRead: updated.count,
    });

  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}

// DELETE - Delete a message
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, messageId } = body;

    if (!userId || !messageId) {
      return NextResponse.json({ 
        error: 'User ID and message ID required' 
      }, { status: 400 });
    }

    // Only allow sender to delete
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId,
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    return NextResponse.json({
      success: true,
      message: 'Message deleted',
    });

  } catch (error) {
    console.error('Delete message error:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}
