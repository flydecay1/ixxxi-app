// lib/solana/tokenGate.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export type GateType = 'token' | 'nft' | 'none';

export interface GateCheckResult {
  hasAccess: boolean;
  balance: number;
  gateType: GateType;
  error?: string;
}

export interface TokenGateConfig {
  requiredTokenMint?: string;
  requiredTokenAmount?: number;
  collectionAddress?: string;
  gateType: GateType;
}

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

/**
 * Check if a wallet owns a specific SPL token
 */
export async function checkTokenOwnership(
  walletAddress: string,
  requiredTokenMint: string,
  minimumAmount: number = 1,
  connection?: Connection
): Promise<GateCheckResult> {
  const conn = connection || new Connection(RPC_URL, 'confirmed');

  try {
    const walletPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(requiredTokenMint);

    // Get token accounts for this specific mint
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
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
      gateType: 'token',
    };
  } catch (error) {
    console.error('Token gate check failed:', error);
    return {
      hasAccess: false,
      balance: 0,
      gateType: 'token',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a wallet owns any NFT (simplified check for NFTs with decimals=0, amount=1)
 * For production, integrate with Metaplex SDK for proper collection verification
 */
export async function checkNFTOwnership(
  walletAddress: string,
  collectionAddress?: string,
  connection?: Connection
): Promise<GateCheckResult> {
  const conn = connection || new Connection(RPC_URL, 'confirmed');

  try {
    const walletPubkey = new PublicKey(walletAddress);

    // Get all token accounts
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
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

    // If collection address is specified, we'd need to verify the NFT belongs to that collection
    // This requires Metaplex metadata queries - simplified for now
    if (collectionAddress) {
      // TODO: Implement proper Metaplex collection verification
      // For now, we just check if they have any NFTs
      console.log(`Collection verification for ${collectionAddress} - simplified check`);
    }

    return {
      hasAccess: nfts.length > 0,
      balance: nfts.length,
      gateType: 'nft',
    };
  } catch (error) {
    console.error('NFT gate check failed:', error);
    return {
      hasAccess: false,
      balance: 0,
      gateType: 'nft',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check SOL balance (native token)
 */
export async function checkSOLBalance(
  walletAddress: string,
  minimumSOL: number = 0,
  connection?: Connection
): Promise<GateCheckResult> {
  const conn = connection || new Connection(RPC_URL, 'confirmed');

  try {
    const walletPubkey = new PublicKey(walletAddress);
    const balance = await conn.getBalance(walletPubkey);
    const solBalance = balance / 1e9; // Convert lamports to SOL

    return {
      hasAccess: solBalance >= minimumSOL,
      balance: solBalance,
      gateType: 'token',
    };
  } catch (error) {
    console.error('SOL balance check failed:', error);
    return {
      hasAccess: false,
      balance: 0,
      gateType: 'token',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Universal gate check that handles all gate types
 */
export async function checkGate(
  walletAddress: string | null,
  config: TokenGateConfig,
  connection?: Connection
): Promise<GateCheckResult> {
  // No gate required
  if (config.gateType === 'none') {
    return { hasAccess: true, balance: 0, gateType: 'none' };
  }

  // Wallet not connected
  if (!walletAddress) {
    return {
      hasAccess: false,
      balance: 0,
      gateType: config.gateType,
      error: 'Wallet not connected',
    };
  }

  // Token gate
  if (config.gateType === 'token' && config.requiredTokenMint) {
    return checkTokenOwnership(
      walletAddress,
      config.requiredTokenMint,
      config.requiredTokenAmount || 1,
      connection
    );
  }

  // NFT gate
  if (config.gateType === 'nft') {
    return checkNFTOwnership(
      walletAddress,
      config.collectionAddress,
      connection
    );
  }

  // Default: no access if gate type is unknown
  return {
    hasAccess: false,
    balance: 0,
    gateType: config.gateType,
    error: 'Invalid gate configuration',
  };
}
