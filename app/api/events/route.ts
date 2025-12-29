// app/api/events/route.ts
// Event ticketing system

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// GET /api/events - List events or get details
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const artistId = searchParams.get('artistId');
  const userId = searchParams.get('userId');
  const type = searchParams.get('type'); // "concert" | "meetup" | "listening_party" | "livestream" | "festival"
  const upcoming = searchParams.get('upcoming') !== 'false';
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // Get single event
    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isVerified: true,
            },
          },
          ticketTiers: {
            orderBy: { price: 'asc' },
          },
          _count: {
            select: { tickets: true },
          },
        },
      });

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      // Get ticket availability
      const ticketsSold = await prisma.ticket.groupBy({
        by: ['tierId'],
        where: { eventId, status: { in: ['confirmed', 'checked_in'] } },
        _count: true,
      });

      const tiers = event.ticketTiers.map(tier => {
        const sold = ticketsSold.find(t => t.tierId === tier.id)?._count || 0;
        return {
          ...tier,
          sold,
          available: tier.quantity - sold,
          isSoldOut: sold >= tier.quantity,
        };
      });

      return NextResponse.json({
        event: {
          ...event,
          ticketTiers: tiers,
          totalTicketsSold: event._count.tickets,
        },
      });
    }

    // Get user's tickets
    if (userId) {
      const tickets = await prisma.ticket.findMany({
        where: { userId },
        include: {
          event: {
            include: {
              artist: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          },
          tier: true,
        },
        orderBy: { event: { startDate: 'asc' } },
      });

      return NextResponse.json({ tickets });
    }

    // List events
    const where: any = {};
    
    if (artistId) where.artistId = artistId;
    if (type) where.type = type;
    if (upcoming) {
      where.startDate = { gte: new Date() };
      where.status = 'published';
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        artist: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
        ticketTiers: {
          orderBy: { price: 'asc' },
          take: 1, // Just get lowest price tier
        },
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: { startDate: 'asc' },
      take: limit,
    });

    return NextResponse.json({
      events: events.map(e => ({
        ...e,
        startingPrice: e.ticketTiers[0]?.price || 0,
        ticketsSold: e._count.tickets,
      })),
    });
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json({ error: 'Failed to get events' }, { status: 500 });
  }
}

// POST /api/events - Create event or purchase ticket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'purchase' } = body;

    // Create new event (artist only)
    if (action === 'create') {
      const {
        artistId,
        title,
        description,
        type,
        venue,
        address,
        city,
        country,
        latitude,
        longitude,
        startDate,
        endDate,
        timezone,
        coverUrl,
        ticketTiers, // [{ name, price, quantity, description, perks }]
        isTokenGated = false,
        requiredTokenAmount,
        holderEarlyAccess, // hours
        holderDiscount, // percentage
      } = body;

      if (!artistId || !title || !startDate || !type) {
        return NextResponse.json({
          error: 'artistId, title, startDate, and type required',
        }, { status: 400 });
      }

      const event = await prisma.event.create({
        data: {
          artistId,
          title,
          description,
          type,
          venue,
          address,
          city,
          country,
          latitude,
          longitude,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          timezone: timezone || 'UTC',
          coverUrl,
          isTokenGated,
          requiredTokenAmount,
          holderEarlyAccess,
          holderDiscount,
          status: 'draft',
          ticketTiers: ticketTiers?.length ? {
            create: ticketTiers.map((t: any, index: number) => ({
              name: t.name,
              price: t.price,
              currency: t.currency || 'USDC',
              quantity: t.quantity,
              description: t.description,
              perks: t.perks ? JSON.stringify(t.perks) : null,
              position: index,
            })),
          } : undefined,
        },
        include: { ticketTiers: true },
      });

      return NextResponse.json({ success: true, event });
    }

    // Purchase ticket
    if (action === 'purchase') {
      const {
        eventId,
        tierId,
        userId,
        quantity = 1,
        txSignature,
        attendeeName,
        attendeeEmail,
      } = body;

      if (!eventId || !tierId || !userId) {
        return NextResponse.json({
          error: 'eventId, tierId, and userId required',
        }, { status: 400 });
      }

      // Get event and tier
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          ticketTiers: { where: { id: tierId } },
          artist: true,
        },
      });

      if (!event || event.ticketTiers.length === 0) {
        return NextResponse.json({ error: 'Event or tier not found' }, { status: 404 });
      }

      if (event.status !== 'published') {
        return NextResponse.json({ error: 'Event is not available' }, { status: 400 });
      }

      const tier = event.ticketTiers[0];

      // Check availability
      const ticketsSold = await prisma.ticket.count({
        where: { eventId, tierId, status: { in: ['confirmed', 'checked_in'] } },
      });

      if (ticketsSold + quantity > tier.quantity) {
        return NextResponse.json({ error: 'Not enough tickets available' }, { status: 400 });
      }

      // Check token gating
      if (event.isTokenGated) {
        // TODO: Verify user holds required tokens
      }

      // Calculate price (with potential holder discount)
      let unitPrice = tier.price;
      // TODO: Apply holder discount if applicable

      const total = unitPrice * quantity;
      const platformFee = total * 0.05; // 5% platform fee
      const artistAmount = total - platformFee;

      // Create tickets
      const tickets = [];
      for (let i = 0; i < quantity; i++) {
        const ticketCode = generateTicketCode();
        const qrCode = generateQRData(eventId, ticketCode);

        const ticket = await prisma.ticket.create({
          data: {
            eventId,
            tierId,
            userId,
            ticketCode,
            qrCode,
            price: unitPrice,
            currency: tier.currency,
            txSignature,
            attendeeName,
            attendeeEmail,
            status: 'confirmed',
          },
        });
        tickets.push(ticket);
      }

      // Update artist revenue
      await prisma.artist.update({
        where: { id: event.artistId },
        data: { totalRevenue: { increment: artistAmount } },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'ticket',
          title: '🎫 Ticket Confirmed!',
          message: `Your ticket to "${event.title}" has been confirmed!`,
          data: JSON.stringify({
            eventId,
            ticketIds: tickets.map(t => t.id),
          }),
        },
      });

      return NextResponse.json({
        success: true,
        tickets: tickets.map(t => ({
          id: t.id,
          ticketCode: t.ticketCode,
          qrCode: t.qrCode,
          event: {
            title: event.title,
            venue: event.venue,
            startDate: event.startDate,
          },
          tier: {
            name: tier.name,
          },
        })),
        total,
      });
    }

    // Check in ticket
    if (action === 'checkin') {
      const { ticketCode, eventId } = body;

      if (!ticketCode || !eventId) {
        return NextResponse.json({ error: 'ticketCode and eventId required' }, { status: 400 });
      }

      const ticket = await prisma.ticket.findFirst({
        where: { ticketCode, eventId },
        include: {
          tier: true,
          user: { select: { id: true, username: true } },
        },
      });

      if (!ticket) {
        return NextResponse.json({ error: 'Invalid ticket' }, { status: 404 });
      }

      if (ticket.status === 'checked_in') {
        return NextResponse.json({ 
          error: 'Ticket already checked in',
          checkedInAt: ticket.checkedInAt,
        }, { status: 400 });
      }

      if (ticket.status !== 'confirmed') {
        return NextResponse.json({ error: 'Ticket is not valid' }, { status: 400 });
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'checked_in',
          checkedInAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        ticket: {
          id: ticket.id,
          tier: ticket.tier.name,
          attendeeName: ticket.attendeeName,
          user: ticket.user,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Events error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// PATCH /api/events - Update event
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, artistId, updates } = body;

    if (!eventId || !artistId) {
      return NextResponse.json({ error: 'eventId and artistId required' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.artistId !== artistId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const allowedUpdates: any = {};
    const allowed = ['title', 'description', 'venue', 'address', 'coverUrl', 'status'];
    for (const key of allowed) {
      if (updates[key] !== undefined) allowedUpdates[key] = updates[key];
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: allowedUpdates,
    });

    return NextResponse.json({ success: true, event: updated });
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

// Helper functions
function generateTicketCode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

function generateQRData(eventId: string, ticketCode: string): string {
  const data = { e: eventId, t: ticketCode, ts: Date.now() };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}
