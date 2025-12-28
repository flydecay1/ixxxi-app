// app/api/signup/route.ts
// Legacy signup - redirects to email verification flow
// Use /api/auth/email for new signups

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Keypair } from '@solana/web3.js';

export async function POST(req: NextRequest) {
  try {
    const { email, walletAddress, username } = await req.json();

    // If wallet provided, use Web3 signup
    if (walletAddress) {
      const existing = await prisma.user.findUnique({ 
        where: { walletAddress } 
      });
      
      if (existing) {
        return NextResponse.json({ 
          message: 'User already exists',
          user: {
            id: existing.id,
            walletAddress: existing.walletAddress,
            username: existing.username,
            role: existing.role,
          }
        });
      }

      const user = await prisma.user.create({
        data: {
          walletAddress,
          username: username || `user_${walletAddress.slice(0, 8)}`,
          role: 'listener',
          tier: 'free',
        },
      });

      return NextResponse.json({
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        role: user.role,
      });
    }

    // If email provided without wallet, create embedded wallet
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      
      const existing = await prisma.user.findFirst({ 
        where: { email: normalizedEmail } 
      });
      
      if (existing) {
        return NextResponse.json({ 
          error: 'Email already registered. Please sign in.' 
        }, { status: 400 });
      }

      // Generate embedded wallet
      const keypair = Keypair.generate();
      const embeddedWallet = keypair.publicKey.toBase58();

      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          walletAddress: embeddedWallet,
          username: username || `user_${embeddedWallet.slice(0, 8)}`,
          role: 'listener',
          tier: 'free',
        },
      });

      // Note: In production, store encrypted private key securely
      console.log(`[SIGNUP] Created embedded wallet for ${user.id}`);

      return NextResponse.json({
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        username: user.username,
        role: user.role,
      });
    }

    return NextResponse.json({ 
      error: 'Email or wallet address required' 
    }, { status: 400 });

  } catch (err) {
    console.error('SIGNUP ERROR', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}