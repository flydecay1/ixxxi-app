// app/api/user/route.ts
// User profile API - create, read, update user profiles

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublicKey } from '@solana/web3.js';

// Calculate user tier based on token balance
function calculateTier(tokenBalance: number): string {
  if (tokenBalance >= 10000) return 'whale';
  if (tokenBalance >= 1000) return 'premium';
  if (tokenBalance >= 100) return 'holder';
  return 'free';
}

// GET - Fetch user profile by wallet address
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        artist: true,
        _count: {
          select: {
            plays: true,
            stakes: true,
            following: true,
            followers: true,
            likes: true,
            playlists: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('GET user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update user profile (upsert on wallet connect)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, username, email, avatarUrl, bio } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Validate wallet address
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Validate username if provided
    if (username) {
      if (username.length < 3 || username.length > 20) {
        return NextResponse.json({ error: 'Username must be 3-20 characters' }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return NextResponse.json({ error: 'Username can only contain letters, numbers, and underscores' }, { status: 400 });
      }
      
      // Check if username is taken by another user
      const existingUser = await prisma.user.findUnique({ where: { username } });
      if (existingUser && existingUser.walletAddress !== walletAddress) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        ...(username && { username }),
        ...(email && { email }),
        ...(avatarUrl && { avatarUrl }),
        ...(bio !== undefined && { bio }),
        lastSeenAt: new Date(),
      },
      create: {
        walletAddress,
        username: username || `user_${walletAddress.slice(0, 8)}`,
        email,
        avatarUrl,
        bio,
        role: 'listener',
        tier: 'free',
      },
      include: {
        artist: true,
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('POST user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, ...updates } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Check user exists
    const existingUser = await prisma.user.findUnique({ where: { walletAddress } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Filter allowed updates
    const allowedFields = ['username', 'email', 'avatarUrl', 'bio'];
    const filteredUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    const user = await prisma.user.update({
      where: { walletAddress },
      data: {
        ...filteredUpdates,
        lastSeenAt: new Date(),
      },
      include: {
        artist: true,
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('PATCH user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
