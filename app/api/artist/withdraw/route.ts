// app/api/artist/withdraw/route.ts
// Revenue withdrawal for artists

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

const PLATFORM_WALLET = process.env.PLATFORM_WALLET || '';
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

// Minimum withdrawal amounts
const MIN_WITHDRAWAL_SOL = 0.1;
const MIN_WITHDRAWAL_USDC = 10;

// Platform fee (2.5%)
const WITHDRAWAL_FEE_PERCENT = 2.5;

interface WithdrawalRequest {
  artistId: string;
  amount: number;
  currency: 'SOL' | 'USDC';
  destinationWallet: string;
}

// GET - Get withdrawal history and available balance
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artistId');

  if (!artistId) {
    return NextResponse.json({ error: 'Artist ID required' }, { status: 400 });
  }

  try {
    // Get artist with revenue data
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
      select: {
        id: true,
        name: true,
        wallet: true,
        totalRevenue: true,
      },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Get pending and completed withdrawals
    const [withdrawals, pendingTotal, completedTotal] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { artistId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.withdrawal.aggregate({
        where: { artistId, status: 'pending' },
        _sum: { amount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { artistId, status: 'completed' },
        _sum: { amount: true },
      }),
    ]);

    // Calculate available balance
    const pendingAmount = pendingTotal._sum.amount || 0;
    const withdrawnAmount = completedTotal._sum.amount || 0;
    const availableBalance = artist.totalRevenue - pendingAmount - withdrawnAmount;

    // Get recent earnings breakdown
    const recentEarnings = await prisma.purchase.groupBy({
      by: ['currency'],
      where: {
        track: { artistId },
        status: 'COMPLETED',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _sum: { artistAmount: true },
    });

    return NextResponse.json({
      artistId,
      wallet: artist.wallet,
      totalRevenue: artist.totalRevenue,
      availableBalance,
      pendingWithdrawals: pendingAmount,
      totalWithdrawn: withdrawnAmount,
      minimums: {
        SOL: MIN_WITHDRAWAL_SOL,
        USDC: MIN_WITHDRAWAL_USDC,
      },
      feePercent: WITHDRAWAL_FEE_PERCENT,
      recentEarnings: recentEarnings.map(e => ({
        currency: e.currency,
        amount: e._sum.artistAmount || 0,
      })),
      withdrawals: withdrawals.map(w => ({
        id: w.id,
        amount: w.amount,
        fee: w.fee,
        netAmount: w.netAmount,
        currency: w.currency,
        status: w.status,
        txSignature: w.txSignature,
        destinationWallet: w.destinationWallet,
        createdAt: w.createdAt,
        completedAt: w.completedAt,
      })),
    });

  } catch (error) {
    console.error('Get withdrawal info error:', error);
    return NextResponse.json({ error: 'Failed to get withdrawal info' }, { status: 500 });
  }
}

// POST - Request withdrawal
export async function POST(request: NextRequest) {
  try {
    const body: WithdrawalRequest = await request.json();
    const { artistId, amount, currency, destinationWallet } = body;

    if (!artistId || !amount || !currency || !destinationWallet) {
      return NextResponse.json({
        error: 'Artist ID, amount, currency, and destination wallet required',
      }, { status: 400 });
    }

    // Validate currency
    if (!['SOL', 'USDC'].includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    // Validate minimum
    const minAmount = currency === 'SOL' ? MIN_WITHDRAWAL_SOL : MIN_WITHDRAWAL_USDC;
    if (amount < minAmount) {
      return NextResponse.json({
        error: `Minimum withdrawal is ${minAmount} ${currency}`,
      }, { status: 400 });
    }

    // Validate wallet address
    try {
      new PublicKey(destinationWallet);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Get artist
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Calculate available balance
    const [pendingTotal, completedTotal] = await Promise.all([
      prisma.withdrawal.aggregate({
        where: { artistId, status: 'pending' },
        _sum: { amount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { artistId, status: 'completed' },
        _sum: { amount: true },
      }),
    ]);

    const pendingAmount = pendingTotal._sum.amount || 0;
    const withdrawnAmount = completedTotal._sum.amount || 0;
    const availableBalance = artist.totalRevenue - pendingAmount - withdrawnAmount;

    if (amount > availableBalance) {
      return NextResponse.json({
        error: `Insufficient balance. Available: ${availableBalance.toFixed(4)} ${currency}`,
      }, { status: 400 });
    }

    // Calculate fee
    const fee = amount * (WITHDRAWAL_FEE_PERCENT / 100);
    const netAmount = amount - fee;

    // Create withdrawal request
    const withdrawal = await prisma.withdrawal.create({
      data: {
        artistId,
        amount,
        fee,
        netAmount,
        currency,
        destinationWallet,
        status: 'pending',
      },
    });

    // For demo/testnet: auto-process small withdrawals
    // In production, this would go through a review queue
    if (process.env.NODE_ENV === 'development' || amount < 1) {
      // Process withdrawal (simplified)
      try {
        const txSignature = await processWithdrawal(withdrawal.id, netAmount, currency, destinationWallet);
        
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'completed',
            txSignature,
            completedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          withdrawalId: withdrawal.id,
          amount,
          fee,
          netAmount,
          currency,
          status: 'completed',
          txSignature,
        });
      } catch (err) {
        // Mark as failed
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'failed',
            error: err instanceof Error ? err.message : 'Transfer failed',
          },
        });

        return NextResponse.json({
          error: 'Withdrawal processing failed',
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawal.id,
      amount,
      fee,
      netAmount,
      currency,
      status: 'pending',
      message: 'Withdrawal request submitted for processing',
    });

  } catch (error) {
    console.error('Withdrawal request error:', error);
    return NextResponse.json({ error: 'Withdrawal request failed' }, { status: 500 });
  }
}

// Helper: Process withdrawal on-chain
async function processWithdrawal(
  withdrawalId: string,
  amount: number,
  currency: string,
  destination: string
): Promise<string> {
  // This is a simplified version
  // In production, you'd use a secure backend wallet and proper transaction handling
  
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  
  // For SOL transfers
  if (currency === 'SOL') {
    // In production, this would be signed by a backend wallet
    // For now, we just return a placeholder
    console.log(`Processing ${amount} SOL withdrawal to ${destination}`);
    
    // Return mock signature for development
    if (process.env.NODE_ENV === 'development') {
      return `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    throw new Error('Production withdrawals require manual processing');
  }

  // For USDC transfers
  if (currency === 'USDC') {
    console.log(`Processing ${amount} USDC withdrawal to ${destination}`);
    
    if (process.env.NODE_ENV === 'development') {
      return `dev_usdc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    throw new Error('Production withdrawals require manual processing');
  }

  throw new Error('Unsupported currency');
}

// DELETE - Cancel pending withdrawal
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { withdrawalId, artistId } = body;

    if (!withdrawalId || !artistId) {
      return NextResponse.json({
        error: 'Withdrawal ID and artist ID required',
      }, { status: 400 });
    }

    // Verify ownership and status
    const withdrawal = await prisma.withdrawal.findFirst({
      where: {
        id: withdrawalId,
        artistId,
        status: 'pending',
      },
    });

    if (!withdrawal) {
      return NextResponse.json({
        error: 'Pending withdrawal not found',
      }, { status: 404 });
    }

    // Delete the withdrawal request
    await prisma.withdrawal.delete({
      where: { id: withdrawalId },
    });

    return NextResponse.json({
      success: true,
      message: 'Withdrawal cancelled',
    });

  } catch (error) {
    console.error('Cancel withdrawal error:', error);
    return NextResponse.json({ error: 'Failed to cancel withdrawal' }, { status: 500 });
  }
}
