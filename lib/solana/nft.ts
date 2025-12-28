// lib/solana/nft.ts
// Metaplex NFT minting for track NFTs

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  mplTokenMetadata,
  createNft,
  fetchDigitalAsset,
} from '@metaplex-foundation/mpl-token-metadata';
import { 
  generateSigner,
  percentAmount,
  publicKey,
  keypairIdentity,
} from '@metaplex-foundation/umi';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Get RPC endpoint
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';

// Initialize UMI with Metaplex
export function createUmiInstance() {
  const umi = createUmi(RPC_ENDPOINT).use(mplTokenMetadata());
  return umi;
}

// NFT Metadata structure for tracks
export interface TrackNFTMetadata {
  name: string;           // Track title
  symbol: string;         // Ticker e.g. "TRACK"
  description: string;    // Track description
  image: string;          // Cover art URL
  animation_url?: string; // Audio file URL (optional for NFT)
  external_url?: string;  // Link to IXXXI page
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
  properties: {
    files: {
      uri: string;
      type: string;
    }[];
    category: string;
    creators: {
      address: string;
      share: number;
    }[];
  };
}

/**
 * Create NFT metadata JSON for a track
 */
export function createTrackMetadata(
  track: {
    title: string;
    ticker: string;
    description?: string;
    genre?: string;
    duration?: number;
    region?: string;
    coverUrl?: string;
    audioUrl?: string;
  },
  artistWallet: string,
  collaborators: { wallet: string; share: number }[] = []
): TrackNFTMetadata {
  // Calculate creator shares (must sum to 100)
  const creators = [
    { address: artistWallet, share: collaborators.length === 0 ? 100 : 100 - collaborators.reduce((sum, c) => sum + c.share, 0) },
    ...collaborators.map(c => ({ address: c.wallet, share: c.share }))
  ].filter(c => c.share > 0);

  const attributes: { trait_type: string; value: string | number }[] = [];
  
  if (track.genre) {
    attributes.push({ trait_type: 'Genre', value: track.genre });
  }
  if (track.duration) {
    attributes.push({ trait_type: 'Duration', value: track.duration });
  }
  if (track.region) {
    attributes.push({ trait_type: 'Region', value: track.region });
  }
  attributes.push({ trait_type: 'Platform', value: 'IXXXI' });

  const files: { uri: string; type: string }[] = [];
  if (track.coverUrl) {
    files.push({ uri: track.coverUrl, type: 'image/png' });
  }
  if (track.audioUrl) {
    files.push({ uri: track.audioUrl, type: 'audio/mpeg' });
  }

  return {
    name: track.title,
    symbol: track.ticker.replace('$', '').slice(0, 10),
    description: track.description || `${track.title} - Music NFT on IXXXI`,
    image: track.coverUrl || 'https://ixxxi.app/default-cover.png',
    animation_url: track.audioUrl,
    external_url: `https://ixxxi.app/track/${track.ticker}`,
    attributes,
    properties: {
      files,
      category: 'audio',
      creators,
    },
  };
}

/**
 * Mint a new NFT for a track (server-side with authority keypair)
 * This requires a server-side keypair with SOL for fees
 */
export async function mintTrackNFT(
  metadataUri: string, // URI to JSON metadata on IPFS/Arweave
  recipientWallet: string,
  authorityKeypairBase58: string, // Server authority keypair (base58 encoded)
  royaltyBasisPoints: number = 500 // 5% royalty default
): Promise<{ mint: string; signature: string }> {
  const umi = createUmiInstance();
  
  // Load authority keypair
  const secretKey = bs58.decode(authorityKeypairBase58);
  const authorityKeypair = Keypair.fromSecretKey(secretKey);
  
  // Set identity
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(authorityKeypair.secretKey);
  umi.use(keypairIdentity(umiKeypair));
  
  // Generate mint address
  const mint = generateSigner(umi);
  
  // Create NFT
  const { signature } = await createNft(umi, {
    mint,
    name: 'IXXXI Track', // Will be overwritten by metadata
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(royaltyBasisPoints / 100), // Convert to percentage
    tokenOwner: publicKey(recipientWallet),
  }).sendAndConfirm(umi);
  
  return {
    mint: mint.publicKey.toString(),
    signature: bs58.encode(signature),
  };
}

/**
 * Get NFT data from mint address
 */
export async function getNFTData(mintAddress: string) {
  const umi = createUmiInstance();
  
  try {
    const asset = await fetchDigitalAsset(umi, publicKey(mintAddress));
    return {
      mint: asset.mint.publicKey.toString(),
      name: asset.metadata.name,
      symbol: asset.metadata.symbol,
      uri: asset.metadata.uri,
      sellerFeeBasisPoints: asset.metadata.sellerFeeBasisPoints,
      creators: asset.metadata.creators,
    };
  } catch (error) {
    console.error('Failed to fetch NFT:', error);
    return null;
  }
}

/**
 * Check if a wallet owns a specific NFT
 */
export async function checkNFTOwnership(
  walletAddress: string,
  mintAddress: string
): Promise<boolean> {
  const connection = new Connection(RPC_ENDPOINT);
  
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(mintAddress) }
    );
    
    return tokenAccounts.value.some(
      account => account.account.data.parsed.info.tokenAmount.uiAmount === 1
    );
  } catch (error) {
    console.error('Failed to check NFT ownership:', error);
    return false;
  }
}

/**
 * Get all NFTs owned by a wallet (for collection checking)
 */
export async function getWalletNFTs(walletAddress: string): Promise<string[]> {
  const connection = new Connection(RPC_ENDPOINT);
  
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    // Filter for NFTs (amount = 1, decimals = 0)
    const nfts = tokenAccounts.value
      .filter(account => {
        const info = account.account.data.parsed.info;
        return info.tokenAmount.decimals === 0 && info.tokenAmount.uiAmount === 1;
      })
      .map(account => account.account.data.parsed.info.mint);
    
    return nfts;
  } catch (error) {
    console.error('Failed to get wallet NFTs:', error);
    return [];
  }
}
