// app/api/artist/route.ts
// Artist profile API - create and manage artist profiles

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublicKey } from '@solana/web3.js';

// GET - Fetch artist by ID or wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get('id');
    const walletAddress = searchParams.get('wallet');

    if (!artistId && !walletAddress) {
      return NextResponse.json({ error: 'Artist ID or wallet required' }, { status: 400 });
    }

    let artist;

    if (artistId) {
      artist = await prisma.artist.findUnique({
        where: { id: artistId },
        include: {
          user: { select: { walletAddress: true, username: true } },
          _count: { select: { tracks: true } }
        }
      });
    } else if (walletAddress) {
      const user = await prisma.user.findUnique({
        where: { walletAddress },
        include: { 
          artist: {
            include: {
              _count: { select: { tracks: true } }
            }
          }
        }
      });
      artist = user?.artist;
    }

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    return NextResponse.json(artist);
  } catch (error) {
    console.error('GET artist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create artist profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      walletAddress, 
      name, 
      bio, 
      genre,
      website,
      twitter,
      instagram,
      spotifyUrl,
      soundcloudUrl,
    } = body;

    if (!walletAddress || !name) {
      return NextResponse.json({ error: 'Wallet address and name required' }, { status: 400 });
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found. Connect wallet first.' }, { status: 404 });
    }

    if (user.artist) {
      return NextResponse.json({ error: 'Already an artist' }, { status: 409 });
    }

    // Validate name
    if (name.length < 2 || name.length > 50) {
      return NextResponse.json({ error: 'Name must be 2-50 characters' }, { status: 400 });
    }

    // Build social links JSON
    const socialLinks: Record<string, string> = {};
    if (website) socialLinks.website = website;
    if (twitter) socialLinks.twitter = twitter;
    if (instagram) socialLinks.instagram = instagram;
    if (spotifyUrl) socialLinks.spotify = spotifyUrl;
    if (soundcloudUrl) socialLinks.soundcloud = soundcloudUrl;

    // Create artist profile
    const artist = await prisma.artist.create({
      data: {
        name,
        bio,
        genre,
        links: JSON.stringify(socialLinks),
        userId: user.id,
      }
    });

    // Update user role
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'artist' }
    });

    return NextResponse.json(artist, { status: 201 });
  } catch (error) {
    console.error('POST artist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update artist profile
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, ...updates } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Verify ownership
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { artist: true }
    });

    if (!user?.artist) {
      return NextResponse.json({ error: 'Artist profile not found' }, { status: 404 });
    }

    // Filter allowed updates
    const allowedFields = ['name', 'bio', 'genre', 'avatarUrl', 'bannerUrl', 'links'];
    const filteredUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = field === 'links' 
          ? JSON.stringify(updates[field]) 
          : updates[field];
      }
    }

    const artist = await prisma.artist.update({
      where: { id: user.artist.id },
      data: filteredUpdates,
    });

    return NextResponse.json(artist);
  } catch (error) {
    console.error('PATCH artist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}