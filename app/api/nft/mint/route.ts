// app/api/nft/mint/route.ts
// NFT minting API for tracks

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  createTrackMetadata, 
  mintTrackNFT, 
  getNFTData 
} from '@/lib/solana/nft';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, artistWallet, editionSize = 100 } = body;

    if (!trackId || !artistWallet) {
      return NextResponse.json(
        { error: 'Missing trackId or artistWallet' },
        { status: 400 }
      );
    }

    // Get track details
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: {
        artist: {
          select: {
            id: true,
            wallet: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    // Verify caller is the artist
    if (track.artist?.wallet !== artistWallet) {
      return NextResponse.json(
        { error: 'Only the artist can mint NFTs for their tracks' },
        { status: 403 }
      );
    }

    // Check if NFT already minted
    if (track.nftMint) {
      return NextResponse.json(
        { error: 'NFT already minted for this track', nftMint: track.nftMint },
        { status: 400 }
      );
    }

    // Create metadata for the NFT
    const metadata = createTrackMetadata(
      {
        title: track.title,
        ticker: track.ticker || `$${track.title.slice(0, 6).toUpperCase()}`,
        description: track.description || `${track.title} by ${track.artist?.name}`,
        genre: track.genre || undefined,
        duration: track.duration || undefined,
        region: track.region || undefined,
        coverUrl: track.coverUrl || track.coverKey || 'https://ixxxi.app/default-cover.png',
        audioUrl: track.streamUrl || '',
      },
      artistWallet,
      [] // No collaborators for now
    );

    // In production, you would:
    // 1. Upload metadata to Arweave/IPFS
    // 2. Mint the NFT on Solana using a server keypair
    // 3. Return the transaction for signing
    
    // For now, simulate the metadata upload and return mint info
    // In production, use a service like Bundlr/Arweave or IPFS
    const metadataUri = `https://arweave.net/simulated/${track.id}`; // Placeholder
    
    // Check if we have a minting authority keypair
    const authorityKey = process.env.NFT_MINTING_AUTHORITY;
    
    if (!authorityKey) {
      // Return metadata for client-side minting (user pays gas)
      return NextResponse.json({
        success: true,
        requiresClientMint: true,
        metadata,
        metadataUri: null, // Client needs to upload metadata first
        instructions: 'Upload metadata to Arweave/IPFS, then mint client-side',
      });
    }
    
    // Server-side minting with authority keypair
    try {
      const mintResult = await mintTrackNFT(
        metadataUri,
        artistWallet,
        authorityKey,
        500 // 5% royalty
      );

      // Update track with NFT mint address
      await prisma.track.update({
        where: { id: trackId },
        data: {
          nftMint: mintResult.mint,
          nftMetadataUri: metadataUri,
        },
      });

      return NextResponse.json({
        success: true,
        nftMint: mintResult.mint,
        signature: mintResult.signature,
        metadataUri,
        metadata,
      });
    } catch (mintError) {
      console.error('Minting error:', mintError);
      return NextResponse.json(
        { error: 'NFT minting failed', details: mintError instanceof Error ? mintError.message : 'Unknown' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('NFT minting error:', error);
    return NextResponse.json(
      { error: 'Failed to mint NFT', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Get NFT details for a track
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId');
  const mintAddress = searchParams.get('mint');

  try {
    if (trackId) {
      const track = await prisma.track.findUnique({
        where: { id: trackId },
        select: {
          id: true,
          title: true,
          nftMint: true,
          nftMetadataUri: true,
          artist: {
            select: {
              name: true,
              wallet: true,
            },
          },
        },
      });

      if (!track) {
        return NextResponse.json(
          { error: 'Track not found' },
          { status: 404 }
        );
      }

      if (!track.nftMint) {
        return NextResponse.json({
          hasNFT: false,
          trackId: track.id,
          title: track.title,
        });
      }

      // Get on-chain NFT data
      const nftData = await getNFTData(track.nftMint);

      return NextResponse.json({
        hasNFT: true,
        trackId: track.id,
        title: track.title,
        nftMint: track.nftMint,
        metadataUri: track.nftMetadataUri,
        onChainData: nftData,
      });
    }

    if (mintAddress) {
      const nftData = await getNFTData(mintAddress);
      return NextResponse.json({ nftData });
    }

    return NextResponse.json(
      { error: 'Must provide trackId or mint address' },
      { status: 400 }
    );

  } catch (error) {
    console.error('NFT fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch NFT data' },
      { status: 500 }
    );
  }
}
