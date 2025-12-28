// app/api/user/transactions/route.ts
// User transaction history API

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

// Known program IDs for categorization
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const METAPLEX_TOKEN_METADATA = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

export interface TransactionRecord {
  signature: string;
  type: 'transfer' | 'purchase' | 'nft_mint' | 'token_swap' | 'unknown';
  direction: 'sent' | 'received' | 'self';
  amount?: number;
  currency?: string;
  counterparty?: string;
  timestamp: number;
  status: 'confirmed' | 'finalized' | 'failed';
  fee?: number;
  memo?: string;
  trackId?: string;
  trackTitle?: string;
}

// GET - Get transaction history for a wallet
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const before = searchParams.get('before'); // Pagination cursor (signature)
  const type = searchParams.get('type'); // Filter by type

  if (!wallet) {
    return NextResponse.json(
      { error: 'Wallet address required' },
      { status: 400 }
    );
  }

  try {
    const connection = new Connection(RPC_ENDPOINT);
    const pubkey = new PublicKey(wallet);

    // Get transaction signatures
    const signatures = await connection.getSignaturesForAddress(pubkey, {
      limit,
      before: before || undefined,
    });

    // Fetch full transaction details
    const transactions: TransactionRecord[] = [];

    for (const sig of signatures) {
      try {
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (tx) {
          const record = await parseTransaction(tx, wallet);
          
          // Apply type filter if specified
          if (!type || record.type === type) {
            // Try to enrich with DB data (track info, etc.)
            const enriched = await enrichTransaction(record);
            transactions.push(enriched);
          }
        }
      } catch (err) {
        // Skip failed transaction fetches
        console.error(`Failed to fetch tx ${sig.signature}:`, err);
      }
    }

    // Get pagination cursor
    const nextCursor = signatures.length === limit 
      ? signatures[signatures.length - 1].signature 
      : null;

    return NextResponse.json({
      transactions,
      pagination: {
        limit,
        hasMore: !!nextCursor,
        nextCursor,
      },
      wallet,
    });

  } catch (error) {
    console.error('Transaction history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

/**
 * Parse a transaction into a readable format
 */
async function parseTransaction(
  tx: ParsedTransactionWithMeta,
  userWallet: string
): Promise<TransactionRecord> {
  const sig = tx.transaction.signatures[0];
  const timestamp = tx.blockTime || 0;
  const status = tx.meta?.err ? 'failed' : 'finalized';
  const fee = tx.meta?.fee ? tx.meta.fee / 1e9 : 0;

  const instructions = tx.transaction.message.instructions;
  const accountKeys = tx.transaction.message.accountKeys.map(k => k.pubkey.toBase58());

  let type: TransactionRecord['type'] = 'unknown';
  let direction: TransactionRecord['direction'] = 'self';
  let amount: number | undefined;
  let currency: string | undefined;
  let counterparty: string | undefined;
  let memo: string | undefined;

  // Analyze instructions to determine transaction type
  for (const ix of instructions) {
    if ('parsed' in ix) {
      const parsed = ix.parsed;
      
      // System program transfers (SOL)
      if (ix.program === 'system' && parsed.type === 'transfer') {
        type = 'transfer';
        amount = parsed.info.lamports / 1e9;
        currency = 'SOL';
        
        if (parsed.info.source === userWallet) {
          direction = 'sent';
          counterparty = parsed.info.destination;
        } else if (parsed.info.destination === userWallet) {
          direction = 'received';
          counterparty = parsed.info.source;
        }
      }
      
      // SPL Token transfers
      if (ix.program === 'spl-token' && parsed.type === 'transfer') {
        type = 'transfer';
        amount = parsed.info.amount / 1e6; // Assuming 6 decimals
        currency = 'TOKEN';
        
        // Would need to look up token mint for actual symbol
      }
      
      // Memo program
      if (ix.programId?.toBase58() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
        memo = parsed;
      }
    }
  }

  // Check for NFT minting (Metaplex)
  const programIds = instructions.map(ix => 
    'programId' in ix ? ix.programId.toBase58() : ''
  );
  
  if (programIds.includes(METAPLEX_TOKEN_METADATA)) {
    type = 'nft_mint';
  }

  return {
    signature: sig,
    type,
    direction,
    amount,
    currency,
    counterparty,
    timestamp: timestamp * 1000, // Convert to ms
    status,
    fee,
    memo,
  };
}

/**
 * Enrich transaction with database info (track titles, etc.)
 */
async function enrichTransaction(
  record: TransactionRecord
): Promise<TransactionRecord> {
  // Check if this transaction is a purchase in our DB
  try {
    const purchase = await prisma.purchase.findFirst({
      where: { txSignature: record.signature },
      include: {
        track: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (purchase) {
      record.type = 'purchase';
      record.trackId = purchase.track.id;
      record.trackTitle = purchase.track.title;
    }
  } catch {
    // DB query failed, continue without enrichment
  }

  return record;
}

// POST - Record a transaction (for tracking purchases, etc.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signature, wallet, type, metadata } = body;

    if (!signature || !wallet) {
      return NextResponse.json(
        { error: 'Missing signature or wallet' },
        { status: 400 }
      );
    }

    // Verify transaction exists on-chain
    const connection = new Connection(RPC_ENDPOINT);
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return NextResponse.json(
        { error: 'Transaction not found on-chain' },
        { status: 404 }
      );
    }

    if (tx.meta?.err) {
      return NextResponse.json(
        { error: 'Transaction failed' },
        { status: 400 }
      );
    }

    // Store transaction record in DB
    // This would go to a Transaction table
    return NextResponse.json({
      success: true,
      signature,
      type: type || 'unknown',
      confirmed: true,
    });

  } catch (error) {
    console.error('Transaction record error:', error);
    return NextResponse.json(
      { error: 'Failed to record transaction' },
      { status: 500 }
    );
  }
}
