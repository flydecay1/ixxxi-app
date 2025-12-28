// app/api/purchase/route.ts
// Content purchase API - buy tracks/videos with SOL or $IXXXI token

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  PublicKey, 
  Connection, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET || 'PLATFORM_WALLET_ADDRESS';
const IXXXI_TOKEN_MINT = process.env.IXXXI_TOKEN_MINT || 'TOKEN_MINT_ADDRESS';

// Revenue split
const ARTIST_SHARE = 0.90;  // 90% to artist
const PLATFORM_SHARE = 0.07; // 7% to platform
const REFERRER_SHARE = 0.03; // 3% to referrer

interface PurchaseRequest {
  walletAddress: string;
  contentId: string;
  contentType: 'track' | 'video' | 'album';
  paymentMethod: 'sol' | 'token';
  referrerWallet?: string;
}

// GET - Check purchase status / get purchase history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const contentId = searchParams.get('contentId');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
    }

    // Check if user owns specific content
    if (contentId) {
      // In production, check Purchase table
      // For now, return mock
      return NextResponse.json({
        owned: false,
        purchaseDate: null,
        transactionSignature: null,
      });
    }

    // Return purchase history
    // In production, query Purchase table
    return NextResponse.json({
      purchases: [],
      totalSpentSOL: 0,
      totalSpentToken: 0,
    });
  } catch (error) {
    console.error('GET purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Initiate a purchase (creates transaction for signing)
export async function POST(request: NextRequest) {
  try {
    const body: PurchaseRequest = await request.json();
    const { walletAddress, contentId, contentType, paymentMethod, referrerWallet } = body;

    if (!walletAddress || !contentId || !paymentMethod) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate buyer wallet
    let buyerPubkey: PublicKey;
    try {
      buyerPubkey = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 });
    }

    // Get content and price
    const track = await prisma.track.findUnique({
      where: { id: contentId },
      include: {
        artist: {
          include: {
            user: { select: { walletAddress: true } }
          }
        }
      }
    });

    if (!track) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Determine price
    const priceSOL = track.priceSOL || 0.1; // Default 0.1 SOL
    const priceToken = track.priceToken || 100; // Default 100 $IXXXI

    if (paymentMethod === 'sol' && !priceSOL) {
      return NextResponse.json({ error: 'SOL payments not available' }, { status: 400 });
    }
    if (paymentMethod === 'token' && !priceToken) {
      return NextResponse.json({ error: 'Token payments not available' }, { status: 400 });
    }

    // Get artist wallet
    const artistWallet = track.artist.user.walletAddress;
    if (!artistWallet) {
      return NextResponse.json({ error: 'Artist wallet not configured' }, { status: 400 });
    }

    // Build transaction
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: buyerPubkey,
    });

    if (paymentMethod === 'sol') {
      // SOL payment with revenue split
      const totalLamports = Math.floor(priceSOL * LAMPORTS_PER_SOL);
      const artistLamports = Math.floor(totalLamports * ARTIST_SHARE);
      const platformLamports = Math.floor(totalLamports * PLATFORM_SHARE);
      const referrerLamports = referrerWallet ? Math.floor(totalLamports * REFERRER_SHARE) : 0;

      // Transfer to artist (90%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: buyerPubkey,
          toPubkey: new PublicKey(artistWallet),
          lamports: artistLamports,
        })
      );

      // Transfer to platform (7%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: buyerPubkey,
          toPubkey: new PublicKey(PLATFORM_WALLET),
          lamports: platformLamports,
        })
      );

      // Transfer to referrer if exists (3%)
      if (referrerWallet && referrerLamports > 0) {
        try {
          const referrerPubkey = new PublicKey(referrerWallet);
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: buyerPubkey,
              toPubkey: referrerPubkey,
              lamports: referrerLamports,
            })
          );
        } catch {
          // Invalid referrer, skip
        }
      }
    } else {
      // Token payment
      const tokenMint = new PublicKey(IXXXI_TOKEN_MINT);
      const totalAmount = Math.floor(priceToken * 1e9); // Assuming 9 decimals
      
      // Get token accounts
      const buyerTokenAccount = await getAssociatedTokenAddress(tokenMint, buyerPubkey);
      const artistTokenAccount = await getAssociatedTokenAddress(tokenMint, new PublicKey(artistWallet));
      const platformTokenAccount = await getAssociatedTokenAddress(tokenMint, new PublicKey(PLATFORM_WALLET));

      const artistAmount = Math.floor(totalAmount * ARTIST_SHARE);
      const platformAmount = Math.floor(totalAmount * PLATFORM_SHARE);

      // Transfer to artist
      transaction.add(
        createTransferInstruction(
          buyerTokenAccount,
          artistTokenAccount,
          buyerPubkey,
          artistAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Transfer to platform
      transaction.add(
        createTransferInstruction(
          buyerTokenAccount,
          platformTokenAccount,
          buyerPubkey,
          platformAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Referrer transfer if exists
      if (referrerWallet) {
        try {
          const referrerPubkey = new PublicKey(referrerWallet);
          const referrerTokenAccount = await getAssociatedTokenAddress(tokenMint, referrerPubkey);
          const referrerAmount = Math.floor(totalAmount * REFERRER_SHARE);
          
          transaction.add(
            createTransferInstruction(
              buyerTokenAccount,
              referrerTokenAccount,
              buyerPubkey,
              referrerAmount,
              [],
              TOKEN_PROGRAM_ID
            )
          );
        } catch {
          // Invalid referrer, skip
        }
      }
    }

    // Serialize transaction for client signing
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Create purchase record (pending)
    const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return NextResponse.json({
      purchaseId,
      transaction: serializedTransaction.toString('base64'),
      price: paymentMethod === 'sol' ? priceSOL : priceToken,
      paymentMethod,
      breakdown: {
        artist: paymentMethod === 'sol' 
          ? (priceSOL * ARTIST_SHARE).toFixed(4) + ' SOL'
          : Math.floor(priceToken * ARTIST_SHARE) + ' $IXXXI',
        platform: paymentMethod === 'sol'
          ? (priceSOL * PLATFORM_SHARE).toFixed(4) + ' SOL'
          : Math.floor(priceToken * PLATFORM_SHARE) + ' $IXXXI',
        referrer: referrerWallet
          ? (paymentMethod === 'sol'
              ? (priceSOL * REFERRER_SHARE).toFixed(4) + ' SOL'
              : Math.floor(priceToken * REFERRER_SHARE) + ' $IXXXI')
          : null,
      },
      expiresAt: new Date(Date.now() + 300000).toISOString(), // 5 min expiry
    });
  } catch (error) {
    console.error('POST purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Confirm purchase (after transaction is signed and submitted)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { purchaseId, signature, walletAddress } = body;

    if (!purchaseId || !signature || !walletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify transaction on-chain
    const connection = new Connection(SOLANA_RPC, 'confirmed');
    
    try {
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      if (tx.meta?.err) {
        return NextResponse.json({ error: 'Transaction failed' }, { status: 400 });
      }

      // Transaction confirmed - update purchase record
      // In production, update Purchase table with:
      // - status: 'completed'
      // - transactionSignature: signature
      // - completedAt: now

      return NextResponse.json({
        success: true,
        purchaseId,
        signature,
        message: 'Purchase confirmed! You now have access to this content.',
      });
    } catch (err) {
      console.error('Transaction verification error:', err);
      return NextResponse.json({ error: 'Failed to verify transaction' }, { status: 400 });
    }
  } catch (error) {
    console.error('PUT purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
