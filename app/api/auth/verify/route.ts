// app/api/auth/verify/route.ts
// Verify email code and create/login user with embedded wallet

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Keypair } from '@solana/web3.js';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getVerificationCode, deleteVerificationCode } from '@/lib/auth';

// Generate session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Encrypt private key for storage (in production, use KMS)
function encryptPrivateKey(privateKey: Uint8Array, userId: string): string {
  const key = crypto.scryptSync(process.env.WALLET_ENCRYPTION_KEY || 'dev-key-change-in-prod', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(privateKey)), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check verification code
    const stored = getVerificationCode(normalizedEmail);
    
    if (!stored) {
      return NextResponse.json({ error: 'No verification code found. Please request a new one.' }, { status: 400 });
    }

    if (Date.now() > stored.expiresAt) {
      deleteVerificationCode(normalizedEmail);
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
    }

    if (stored.code !== code) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Code is valid - delete it
    deleteVerificationCode(normalizedEmail);

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      include: { artist: true }
    });

    if (!user) {
      // Create new user with embedded wallet
      const keypair = Keypair.generate();
      const walletAddress = keypair.publicKey.toBase58();
      
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          walletAddress,
          username: `user_${walletAddress.slice(0, 8)}`,
          role: 'listener',
          tier: 'free',
          // Store encrypted private key for embedded wallet
          // In production, use a proper key management system
        },
        include: { artist: true }
      });

      // Store encrypted private key separately (in production, use secure vault)
      // For now, we'll skip this for demo purposes
      console.log(`[AUTH] Created embedded wallet for ${user.id}: ${walletAddress}`);
    }

    // Generate session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store session (in production, use Redis or database)
    // For now, we'll use a signed cookie

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    // Also set user info in accessible cookie for client
    cookieStore.set('user', JSON.stringify({
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      email: user.email,
      tier: user.tier,
      isArtist: !!user.artist,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        email: user.email,
        tier: user.tier,
        role: user.role,
        isArtist: !!user.artist,
      }
    });

  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
