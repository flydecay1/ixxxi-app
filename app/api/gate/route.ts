// app/api/gate/route.ts
// Server-side token gate verification - SECURE
// Never trust client-side gate checks for actual access control

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// Rate limiting: Simple in-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20; // 20 requests per minute per wallet

interface GateRequest {
  walletAddress: string;
  trackId: string;
  gateType: 'token' | 'nft';
  requiredTokenMint?: string;
  requiredTokenAmount?: number;
  collectionAddress?: string;
  // For signature verification (optional but recommended)
  signature?: string;
  message?: string;
}

interface GateResponse {
  hasAccess: boolean;
  balance?: number;
  error?: string;
  accessToken?: string; // JWT or session token for subsequent requests
}

function checkRateLimit(walletAddress: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(walletAddress);
  
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(walletAddress, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Verify wallet signature (optional security layer)
function verifySignature(walletAddress: string, message: string, signature: string): boolean {
  try {
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );
  } catch {
    return false;
  }
}

async function checkTokenOwnership(
  walletAddress: string,
  requiredTokenMint: string,
  minimumAmount: number,
  connection: Connection
): Promise<{ hasAccess: boolean; balance: number }> {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(requiredTokenMint);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { mint: mintPubkey }
    );

    let totalBalance = 0;
    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed.info;
      totalBalance += parsedInfo.tokenAmount.uiAmount || 0;
    }

    return {
      hasAccess: totalBalance >= minimumAmount,
      balance: totalBalance,
    };
  } catch (error) {
    console.error('Token check failed:', error);
    return { hasAccess: false, balance: 0 };
  }
}

async function checkNFTOwnership(
  walletAddress: string,
  collectionAddress: string | undefined,
  connection: Connection
): Promise<{ hasAccess: boolean; balance: number }> {
  try {
    const walletPubkey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId: TOKEN_PROGRAM_ID }
    );

    // Filter for NFTs (decimals = 0, amount = 1)
    const nfts = tokenAccounts.value.filter((account) => {
      const data = account.account.data.parsed.info;
      return (
        data.tokenAmount.decimals === 0 &&
        data.tokenAmount.uiAmount === 1
      );
    });

    // TODO: Implement proper Metaplex collection verification
    // For production, verify NFT metadata matches collection

    return {
      hasAccess: nfts.length > 0,
      balance: nfts.length,
    };
  } catch (error) {
    console.error('NFT check failed:', error);
    return { hasAccess: false, balance: 0 };
  }
}

// Generate a simple access token (use proper JWT in production)
function generateAccessToken(walletAddress: string, trackId: string): string {
  const payload = {
    wallet: walletAddress,
    track: trackId,
    exp: Date.now() + 3600000, // 1 hour expiry
  };
  // In production, sign this with a secret key
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export async function POST(request: NextRequest) {
  try {
    const body: GateRequest = await request.json();
    
    // Validate required fields
    if (!body.walletAddress || !body.trackId || !body.gateType) {
      return NextResponse.json(
        { hasAccess: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    try {
      new PublicKey(body.walletAddress);
    } catch {
      return NextResponse.json(
        { hasAccess: false, error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Rate limiting
    if (!checkRateLimit(body.walletAddress)) {
      return NextResponse.json(
        { hasAccess: false, error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      );
    }

    // Optional: Verify signature if provided (stronger security)
    if (body.signature && body.message) {
      const isValid = verifySignature(body.walletAddress, body.message, body.signature);
      if (!isValid) {
        return NextResponse.json(
          { hasAccess: false, error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    let result: { hasAccess: boolean; balance: number };

    if (body.gateType === 'token') {
      if (!body.requiredTokenMint) {
        return NextResponse.json(
          { hasAccess: false, error: 'Token mint address required' },
          { status: 400 }
        );
      }
      result = await checkTokenOwnership(
        body.walletAddress,
        body.requiredTokenMint,
        body.requiredTokenAmount || 1,
        connection
      );
    } else if (body.gateType === 'nft') {
      result = await checkNFTOwnership(
        body.walletAddress,
        body.collectionAddress,
        connection
      );
    } else {
      return NextResponse.json(
        { hasAccess: false, error: 'Invalid gate type' },
        { status: 400 }
      );
    }

    const response: GateResponse = {
      hasAccess: result.hasAccess,
      balance: result.balance,
    };

    // Generate access token if access granted
    if (result.hasAccess) {
      response.accessToken = generateAccessToken(body.walletAddress, body.trackId);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Gate check error:', error);
    return NextResponse.json(
      { hasAccess: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'gate-verification' });
}
