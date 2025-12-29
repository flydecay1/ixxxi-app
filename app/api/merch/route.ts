// app/api/merch/route.ts
// Merchandise store for artists

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/merch - List merch or get item details
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');
  const artistId = searchParams.get('artistId');
  const category = searchParams.get('category'); // "apparel" | "vinyl" | "accessories" | "digital" | "collectible"
  const featured = searchParams.get('featured') === 'true';
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // Get single item
    if (itemId) {
      const item = await prisma.merchItem.findUnique({
        where: { id: itemId },
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isVerified: true,
            },
          },
          variants: true,
        },
      });

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      return NextResponse.json({ item });
    }

    // List items
    const where: any = { status: 'active' };
    
    if (artistId) where.artistId = artistId;
    if (category) where.category = category;
    if (featured) where.isFeatured = true;

    const items = await prisma.merchItem.findMany({
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
        variants: {
          where: { stock: { gt: 0 } },
          take: 1,
        },
      },
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Get categories with counts
    const categories = await prisma.merchItem.groupBy({
      by: ['category'],
      where: artistId ? { artistId, status: 'active' } : { status: 'active' },
      _count: true,
    });

    return NextResponse.json({
      items,
      categories: categories.map(c => ({
        name: c.category,
        count: c._count,
      })),
    });
  } catch (error) {
    console.error('Get merch error:', error);
    return NextResponse.json({ error: 'Failed to get merch' }, { status: 500 });
  }
}

// POST /api/merch - Create item or place order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'order' } = body;

    // Create new merch item (artist only)
    if (action === 'create') {
      const {
        artistId,
        name,
        description,
        category,
        basePrice,
        currency = 'USDC',
        images, // string[] of URLs
        variants, // [{ name, sku, price, stock, attributes }]
        isLimited = false,
        limitedQuantity,
        releaseDate,
        tokenGated = false,
        requiredTokenAmount,
        holderDiscount, // percentage
      } = body;

      if (!artistId || !name || !basePrice || !category) {
        return NextResponse.json({
          error: 'artistId, name, basePrice, and category required',
        }, { status: 400 });
      }

      const item = await prisma.merchItem.create({
        data: {
          artistId,
          name,
          description,
          category,
          basePrice,
          currency,
          images: images ? JSON.stringify(images) : null,
          isLimited,
          limitedQuantity,
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          tokenGated,
          requiredTokenAmount,
          holderDiscount,
          status: 'active',
          variants: variants?.length ? {
            create: variants.map((v: any) => ({
              name: v.name,
              sku: v.sku || `${name}-${v.name}`.toUpperCase().replace(/\s/g, '-'),
              price: v.price || basePrice,
              stock: v.stock || 0,
              attributes: v.attributes ? JSON.stringify(v.attributes) : null,
            })),
          } : undefined,
        },
        include: { variants: true },
      });

      return NextResponse.json({ success: true, item });
    }

    // Place order
    if (action === 'order') {
      const {
        userId,
        items, // [{ itemId, variantId, quantity }]
        shippingAddress,
        txSignature,
        currency = 'USDC',
      } = body;

      if (!userId || !items?.length) {
        return NextResponse.json({
          error: 'userId and items required',
        }, { status: 400 });
      }

      // Validate items and calculate total
      let total = 0;
      const orderItems = [];

      for (const orderItem of items) {
        const variant = await prisma.merchVariant.findUnique({
          where: { id: orderItem.variantId },
          include: { item: { include: { artist: true } } },
        });

        if (!variant) {
          return NextResponse.json({
            error: `Variant ${orderItem.variantId} not found`,
          }, { status: 400 });
        }

        if (variant.stock < orderItem.quantity) {
          return NextResponse.json({
            error: `${variant.item.name} (${variant.name}) is out of stock`,
          }, { status: 400 });
        }

        // Check token gating
        if (variant.item.tokenGated) {
          // TODO: Verify user holds required tokens
        }

        const itemTotal = variant.price * orderItem.quantity;
        total += itemTotal;

        orderItems.push({
          variantId: variant.id,
          quantity: orderItem.quantity,
          unitPrice: variant.price,
          total: itemTotal,
          artistId: variant.item.artistId,
        });
      }

      // Create order
      const order = await prisma.merchOrder.create({
        data: {
          userId,
          total,
          currency,
          txSignature,
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
          status: 'pending',
          items: {
            create: orderItems.map(item => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  item: true,
                },
              },
            },
          },
        },
      });

      // Decrement stock
      for (const item of orderItems) {
        await prisma.merchVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Update artist revenue
      const artistRevenue = orderItems.reduce((acc, item) => {
        acc[item.artistId] = (acc[item.artistId] || 0) + (item.total * 0.85); // 85% to artist
        return acc;
      }, {} as Record<string, number>);

      for (const [artistId, revenue] of Object.entries(artistRevenue)) {
        await prisma.artist.update({
          where: { id: artistId },
          data: { totalRevenue: { increment: revenue } },
        });
      }

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          total: order.total,
          currency: order.currency,
          status: order.status,
          items: order.items,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Merch error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// PATCH /api/merch - Update item or order status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, updates } = body;

    if (type === 'item') {
      const item = await prisma.merchItem.update({
        where: { id },
        data: updates,
      });
      return NextResponse.json({ success: true, item });
    }

    if (type === 'order') {
      const order = await prisma.merchOrder.update({
        where: { id },
        data: {
          status: updates.status,
          trackingNumber: updates.trackingNumber,
          shippedAt: updates.status === 'shipped' ? new Date() : undefined,
          deliveredAt: updates.status === 'delivered' ? new Date() : undefined,
        },
      });
      return NextResponse.json({ success: true, order });
    }

    if (type === 'variant') {
      const variant = await prisma.merchVariant.update({
        where: { id },
        data: updates,
      });
      return NextResponse.json({ success: true, variant });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Update merch error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/merch - Delete item
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, artistId } = body;

    if (!itemId || !artistId) {
      return NextResponse.json({ error: 'itemId and artistId required' }, { status: 400 });
    }

    const item = await prisma.merchItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.artistId !== artistId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Soft delete (set status to archived)
    await prisma.merchItem.update({
      where: { id: itemId },
      data: { status: 'archived' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete merch error:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
