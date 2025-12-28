// app/api/artist/token/route.ts
// Artist token creation and management API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  createArtistTokenMint,
  getTokenSupply,
  getTokenHolderCount,
  getTokenBalance,
  getUserTokenTier,
  ARTIST_TOKEN_TIERS,
} from '@/lib/solana/artistToken';

// POST - Create new artist token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      artistId, 
      artistWallet, 
      tokenName, 
      tokenSymbol, 
      initialSupply = 1000000,
      decimals = 6,
      metadata 
    } = body;

    if (!artistId || !artistWallet || !tokenName || !tokenSymbol) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate symbol (3-10 uppercase chars)
    if (!/^[A-Z]{3,10}$/.test(tokenSymbol)) {
      return NextResponse.json(
        { error: 'Token symbol must be 3-10 uppercase letters' },
        { status: 400 }
      );
    }

    // Get artist
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
    });

    if (!artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    // Verify caller is the artist
    if (artist.wallet !== artistWallet) {
      return NextResponse.json(
        { error: 'Only the artist can create their token' },
        { status: 403 }
      );
    }

    // Check if artist already has a token
    if (artist.tokenMint) {
      return NextResponse.json(
        { error: 'Artist already has a token', tokenMint: artist.tokenMint },
        { status: 400 }
      );
    }

    // Create the token mint
    const result = await createArtistTokenMint({
      name: tokenName,
      symbol: tokenSymbol,
      decimals,
      initialSupply,
      artistWallet,
      metadata,
    });

    // Update artist with token mint address
    await prisma.artist.update({
      where: { id: artistId },
      data: {
        tokenMint: result.mintAddress,
        tokenSymbol,
        tokenName,
      },
    });

    // Serialize transaction for client signing
    const serializedTx = result.transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      success: true,
      tokenMint: result.mintAddress,
      tokenName,
      tokenSymbol,
      initialSupply,
      decimals,
      transaction: Buffer.from(serializedTx).toString('base64'),
      // Mint keypair must be signed by client
      mintSecretKey: Buffer.from(result.mintKeypair.secretKey).toString('base64'),
      instructions: 'Sign and submit the transaction, then sign with the mint keypair',
    });

  } catch (error) {
    console.error('Token creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create token', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Get artist token info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get('artistId');
  const tokenMint = searchParams.get('mint');
  const holderWallet = searchParams.get('holder');

  try {
    let mint: string | null = tokenMint;

    // Get token mint from artist if provided
    if (artistId && !tokenMint) {
      const artist = await prisma.artist.findUnique({
        where: { id: artistId },
        select: {
          id: true,
          name: true,
          tokenMint: true,
          tokenSymbol: true,
          tokenName: true,
        },
      });

      if (!artist) {
        return NextResponse.json(
          { error: 'Artist not found' },
          { status: 404 }
        );
      }

      if (!artist.tokenMint) {
        return NextResponse.json({
          hasToken: false,
          artistId: artist.id,
          artistName: artist.name,
        });
      }

      mint = artist.tokenMint;
    }

    if (!mint) {
      return NextResponse.json(
        { error: 'Must provide artistId or mint address' },
        { status: 400 }
      );
    }

    // Get on-chain token data
    const [supply, holderCount] = await Promise.all([
      getTokenSupply(mint),
      getTokenHolderCount(mint),
    ]);

    const response: Record<string, unknown> = {
      hasToken: true,
      tokenMint: mint,
      totalSupply: supply.totalSupply,
      decimals: supply.decimals,
      holderCount,
      tiers: ARTIST_TOKEN_TIERS,
    };

    // If holder wallet provided, get their balance and tier
    if (holderWallet) {
      const balance = await getTokenBalance(mint, holderWallet);
      const tier = await getUserTokenTier(mint, holderWallet);

      response.holder = {
        wallet: holderWallet,
        balance,
        tier,
        tierInfo: tier ? ARTIST_TOKEN_TIERS[tier] : null,
      };
    }

    // Add artist info if we have it
    if (artistId) {
      const artist = await prisma.artist.findUnique({
        where: { id: artistId },
        select: {
          id: true,
          name: true,
          tokenSymbol: true,
          tokenName: true,
        },
      });
      
      if (artist) {
        response.artist = artist;
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Token info error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token info' },
      { status: 500 }
    );
  }
}
