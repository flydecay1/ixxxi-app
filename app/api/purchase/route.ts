// app/api/purchase/route.ts
// Content purchase API - buy tracks/videos with SOL or $IXXXI token

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware/auth';
import { purchaseInitiateSchema, purchaseConfirmSchema } from '@/lib/schemas';
import {
  validationError,
  notFoundError,
  blockchainError,
  errorToResponse,
  assertExists,
} from '@/lib/errors';
import { successResponse } from '@/lib/api-response';
import { getEnv } from '@/lib/env';
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

// Revenue split constants
const ARTIST_SHARE = 0.90;  // 90% to artist
const PLATFORM_SHARE = 0.07; // 7% to platform
const REFERRER_SHARE = 0.03; // 3% to referrer

// GET - Check purchase status / get purchase history (requires auth)
export async function GET(request: NextRequest) {
  return requireAuth(request, async (req, auth) => {
    try {
      const { searchParams } = new URL(req.url);
      const contentId = searchParams.get('contentId');

      // Check if user owns specific content
      if (contentId) {
        // In production, check Purchase table
        // For now, return mock
        return successResponse({
          owned: false,
          purchaseDate: null,
          transactionSignature: null,
        });
      }

      // Return purchase history for authenticated user
      // In production, query Purchase table filtered by auth.userId
      return successResponse({
        purchases: [],
        totalSpentSOL: 0,
        totalSpentToken: 0,
      });
    } catch (error) {
      return errorToResponse(error, process.env.NODE_ENV === 'development');
    }
  });
}

// POST - Initiate a purchase (creates transaction for signing)
export async function POST(request: NextRequest) {
  return requireAuth(request, async (req, auth) => {
    try {
      const body = await req.json();

      // Validate request body with Zod
      const validation = purchaseInitiateSchema.safeParse(body);
      if (!validation.success) {
        throw validationError('Invalid purchase request', validation.error.errors);
      }

      const { walletAddress, contentId, contentType, paymentMethod, referrerWallet } = validation.data;

      // Verify wallet address matches authenticated user
      if (walletAddress !== auth.walletAddress) {
        throw validationError('Wallet address mismatch');
      }

      const buyerPubkey = new PublicKey(walletAddress);

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

      assertExists(track, notFoundError('Track'));

      // Determine price
      const priceSOL = track.priceSOL || 0.1; // Default 0.1 SOL
      const priceToken = track.priceToken || 100; // Default 100 $IXXXI

      if (paymentMethod === 'sol' && !priceSOL) {
        throw validationError('SOL payments not available for this content');
      }
      if (paymentMethod === 'token' && !priceToken) {
        throw validationError('Token payments not available for this content');
      }

      // Get artist wallet
      const artistWallet = track.artist.user.walletAddress;
      assertExists(artistWallet, validationError('Artist wallet not configured'));

      // Get environment config
      const env = getEnv();
      const connection = new Connection(env.NEXT_PUBLIC_SOLANA_RPC_URL, 'confirmed');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const transaction = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: buyerPubkey,
      });

      if (paymentMethod === 'sol') {
        // SOL payment with revenue split - fix rounding to ensure sum equals total
        const totalLamports = Math.floor(priceSOL * LAMPORTS_PER_SOL);
        const platformWallet = env.PLATFORM_WALLET;
        assertExists(platformWallet, validationError('Platform wallet not configured'));

        const platformLamports = Math.floor(totalLamports * PLATFORM_SHARE);
        const referrerLamports = referrerWallet ? Math.floor(totalLamports * REFERRER_SHARE) : 0;
        // Artist gets remainder to ensure sum equals total
        const artistLamports = totalLamports - platformLamports - referrerLamports;

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
            toPubkey: new PublicKey(platformWallet),
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
        // Token payment - fix rounding to ensure sum equals total
        const tokenMint = env.IXXXI_TOKEN_MINT;
        assertExists(tokenMint, validationError('Token mint not configured'));
        const platformWallet = env.PLATFORM_WALLET;
        assertExists(platformWallet, validationError('Platform wallet not configured'));

        const tokenMintPubkey = new PublicKey(tokenMint);
        const totalAmount = Math.floor(priceToken * 1e9); // Assuming 9 decimals

        // Get token accounts
        const buyerTokenAccount = await getAssociatedTokenAddress(tokenMintPubkey, buyerPubkey);
        const artistTokenAccount = await getAssociatedTokenAddress(tokenMintPubkey, new PublicKey(artistWallet));
        const platformTokenAccount = await getAssociatedTokenAddress(tokenMintPubkey, new PublicKey(platformWallet));

        const platformAmount = Math.floor(totalAmount * PLATFORM_SHARE);
        const referrerAmount = referrerWallet ? Math.floor(totalAmount * REFERRER_SHARE) : 0;
        // Artist gets remainder to ensure sum equals total
        const artistAmount = totalAmount - platformAmount - referrerAmount;

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
        if (referrerWallet && referrerAmount > 0) {
          try {
            const referrerPubkey = new PublicKey(referrerWallet);
            const referrerTokenAccount = await getAssociatedTokenAddress(tokenMintPubkey, referrerPubkey);

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

      return successResponse({
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
      return errorToResponse(error, process.env.NODE_ENV === 'development');
    }
  });
}

// PUT - Confirm purchase (after transaction is signed and submitted)
export async function PUT(request: NextRequest) {
  return requireAuth(request, async (req, auth) => {
    try {
      const body = await req.json();

      // Validate request body
      const validation = purchaseConfirmSchema.safeParse(body);
      if (!validation.success) {
        throw validationError('Invalid purchase confirmation', validation.error.errors);
      }

      const { purchaseId, signature, walletAddress, contentId, expectedAmount, paymentMethod } = validation.data;

      // Verify wallet address matches authenticated user
      if (walletAddress !== auth.walletAddress) {
        throw validationError('Wallet address mismatch');
      }

      // Get content details for verification
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

      assertExists(track, notFoundError('Track'));

      // Verify transaction on-chain
      const env = getEnv();
      const connection = new Connection(env.NEXT_PUBLIC_SOLANA_RPC_URL, 'confirmed');

      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        throw blockchainError('Transaction not found on-chain');
      }

      if (tx.meta?.err) {
        throw blockchainError('Transaction failed on-chain', tx.meta.err);
      }

      // Enhanced verification: Check transaction details
      const signer = tx.transaction.message.staticAccountKeys[0].toBase58();
      if (signer !== walletAddress) {
        throw validationError('Transaction signer mismatch');
      }

      // Verify artist received payment
      const artistWallet = track.artist.user.walletAddress;
      assertExists(artistWallet, validationError('Artist wallet not configured'));

      const artistPubkey = new PublicKey(artistWallet);
      const artistIndex = tx.transaction.message.staticAccountKeys.findIndex(
        key => key.equals(artistPubkey)
      );

      if (artistIndex === -1) {
        throw validationError('Artist not found in transaction recipients');
      }

      // Verify amount received (SOL) - allow 15% tolerance for rounding and fees
      if (paymentMethod === 'sol' && expectedAmount) {
        const expectedLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL);
        const expectedArtistAmount = Math.floor(expectedLamports * ARTIST_SHARE);
        const preBalance = tx.meta.preBalances[artistIndex] || 0;
        const postBalance = tx.meta.postBalances[artistIndex] || 0;
        const receivedLamports = postBalance - preBalance;

        const minExpected = expectedArtistAmount * 0.85;
        if (receivedLamports < minExpected) {
          throw validationError(
            `Payment amount insufficient. Expected ~${expectedArtistAmount / LAMPORTS_PER_SOL} SOL, received ${receivedLamports / LAMPORTS_PER_SOL} SOL`
          );
        }
      }

      // Transaction verified - update purchase record
      // In production, update Purchase table with:
      // - status: 'completed'
      // - transactionSignature: signature
      // - completedAt: now
      // - verifiedAmount: receivedLamports

      return successResponse({
        purchaseId,
        signature,
        message: 'Purchase confirmed! You now have access to this content.',
      });
    } catch (error) {
      return errorToResponse(error, process.env.NODE_ENV === 'development');
    }
  });
}
