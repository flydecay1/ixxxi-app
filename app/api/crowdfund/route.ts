// app/api/crowdfund/route.ts
// Crowdfunding campaigns for releases

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/crowdfund - List campaigns or get details
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaignId');
  const artistId = searchParams.get('artistId');
  const status = searchParams.get('status'); // "active" | "funded" | "failed" | "all"
  const featured = searchParams.get('featured') === 'true';
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // Get single campaign details
    if (campaignId) {
      const campaign = await prisma.crowdfundCampaign.findUnique({
        where: { id: campaignId },
        include: {
          artist: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isVerified: true,
              totalFollowers: true,
            },
          },
          tiers: {
            orderBy: { amount: 'asc' },
          },
          _count: {
            select: { pledges: true },
          },
        },
      });

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      // Get pledge stats
      const pledgeStats = await prisma.crowdfundPledge.aggregate({
        where: { campaignId },
        _sum: { amount: true },
        _count: true,
      });

      // Recent backers (non-anonymous)
      const recentBackers = await prisma.crowdfundPledge.findMany({
        where: { campaignId, isAnonymous: false },
        include: {
          user: {
            select: { id: true, username: true, avatarUrl: true },
          },
          tier: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const percentFunded = campaign.goalAmount > 0
        ? Math.min(100, Math.round(((pledgeStats._sum.amount || 0) / campaign.goalAmount) * 100))
        : 0;

      return NextResponse.json({
        campaign: {
          ...campaign,
          amountRaised: pledgeStats._sum.amount || 0,
          backerCount: pledgeStats._count,
          percentFunded,
          daysRemaining: Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
        },
        recentBackers,
      });
    }

    // List campaigns
    const where: any = {};
    
    if (artistId) where.artistId = artistId;
    if (featured) where.isFeatured = true;
    
    if (status && status !== 'all') {
      where.status = status;
    } else if (!status) {
      where.status = 'active';
    }

    const campaigns = await prisma.crowdfundCampaign.findMany({
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
        _count: {
          select: { pledges: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get amounts raised for each campaign
    const campaignIds = campaigns.map((c: any) => c.id);
    const pledgeSums = await prisma.crowdfundPledge.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: campaignIds } },
      _sum: { amount: true },
    });

    const campaignsWithStats = campaigns.map((c: any) => {
      const pledgeSum = pledgeSums.find((p: any) => p.campaignId === c.id);
      const amountRaised = pledgeSum?._sum.amount || 0;
      return {
        ...c,
        amountRaised,
        percentFunded: c.goalAmount > 0 ? Math.min(100, Math.round((amountRaised / c.goalAmount) * 100)) : 0,
        daysRemaining: Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      };
    });

    return NextResponse.json({ campaigns: campaignsWithStats });
  } catch (error) {
    console.error('Get campaigns error:', error);
    return NextResponse.json({ error: 'Failed to get campaigns' }, { status: 500 });
  }
}

// POST /api/crowdfund - Create campaign or pledge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'pledge' } = body;

    // Create new campaign
    if (action === 'create') {
      const {
        artistId,
        title,
        description,
        goalAmount,
        currency = 'SOL',
        endDate,
        coverUrl,
        videoUrl,
        releaseType, // "album" | "ep" | "single" | "music_video" | "tour"
        tiers, // [{ name, amount, description, rewards, maxBackers }]
      } = body;

      if (!artistId || !title || !goalAmount || !endDate) {
        return NextResponse.json({
          error: 'artistId, title, goalAmount, and endDate required',
        }, { status: 400 });
      }

      // Validate end date (min 7 days, max 90 days)
      const end = new Date(endDate);
      const minDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      if (end < minDate || end > maxDate) {
        return NextResponse.json({
          error: 'Campaign must be 7-90 days',
        }, { status: 400 });
      }

      const campaign = await prisma.crowdfundCampaign.create({
        data: {
          artistId,
          title,
          description,
          goalAmount,
          currency,
          endDate: end,
          coverUrl,
          videoUrl,
          releaseType: releaseType || 'album',
          status: 'active',
          tiers: tiers?.length ? {
            create: tiers.map((t: any, index: number) => ({
              name: t.name,
              amount: t.amount,
              description: t.description,
              rewards: t.rewards,
              maxBackers: t.maxBackers,
              position: index,
            })),
          } : undefined,
        },
        include: {
          tiers: true,
        },
      });

      return NextResponse.json({
        success: true,
        campaign,
      });
    }

    // Pledge to campaign
    if (action === 'pledge') {
      const {
        campaignId,
        userId,
        tierId,
        amount,
        currency = 'SOL',
        txSignature,
        isAnonymous = false,
        message,
      } = body;

      if (!campaignId || !userId || !amount) {
        return NextResponse.json({
          error: 'campaignId, userId, and amount required',
        }, { status: 400 });
      }

      // Get campaign
      const campaign = await prisma.crowdfundCampaign.findUnique({
        where: { id: campaignId },
        include: { artist: true },
      });

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      if (campaign.status !== 'active') {
        return NextResponse.json({ error: 'Campaign is not active' }, { status: 400 });
      }

      if (new Date(campaign.endDate) < new Date()) {
        return NextResponse.json({ error: 'Campaign has ended' }, { status: 400 });
      }

      // Check tier availability if selected
      if (tierId) {
        const tier = await prisma.crowdfundTier.findUnique({
          where: { id: tierId },
          include: {
            _count: { select: { pledges: true } },
          },
        });

        if (!tier || tier.campaignId !== campaignId) {
          return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        }

        if (tier.maxBackers && tier._count.pledges >= tier.maxBackers) {
          return NextResponse.json({ error: 'Tier is sold out' }, { status: 400 });
        }

        if (amount < tier.amount) {
          return NextResponse.json({ 
            error: `Minimum pledge for this tier is ${tier.amount} ${campaign.currency}` 
          }, { status: 400 });
        }
      }

      // Create pledge
      const pledge = await prisma.crowdfundPledge.create({
        data: {
          campaignId,
          userId,
          tierId,
          amount,
          currency,
          txSignature,
          isAnonymous,
          message: message?.substring(0, 500),
          status: 'completed',
        },
      });

      // Check if campaign is now funded
      const totalRaised = await prisma.crowdfundPledge.aggregate({
        where: { campaignId, status: 'completed' },
        _sum: { amount: true },
      });

      if ((totalRaised._sum.amount || 0) >= campaign.goalAmount) {
        await prisma.crowdfundCampaign.update({
          where: { id: campaignId },
          data: { status: 'funded' },
        });

        // Notify artist
        await prisma.notification.create({
          data: {
            userId: campaign.artist.userId,
            type: 'crowdfund',
            title: '🎉 Campaign Funded!',
            message: `"${campaign.title}" has reached its funding goal!`,
            data: JSON.stringify({ campaignId }),
          },
        });
      }

      return NextResponse.json({
        success: true,
        pledge: {
          id: pledge.id,
          amount: pledge.amount,
          currency: pledge.currency,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Crowdfund error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// PATCH /api/crowdfund - Update campaign
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaignId, artistId, updates } = body;

    if (!campaignId || !artistId) {
      return NextResponse.json({ error: 'campaignId and artistId required' }, { status: 400 });
    }

    const campaign = await prisma.crowdfundCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.artistId !== artistId) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Only allow certain updates
    const allowedUpdates: any = {};
    if (updates.description) allowedUpdates.description = updates.description;
    if (updates.coverUrl) allowedUpdates.coverUrl = updates.coverUrl;
    if (updates.videoUrl) allowedUpdates.videoUrl = updates.videoUrl;

    const updated = await prisma.crowdfundCampaign.update({
      where: { id: campaignId },
      data: allowedUpdates,
    });

    return NextResponse.json({ success: true, campaign: updated });
  } catch (error) {
    console.error('Update campaign error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}
