// lib/solana/artistToken.ts
// Artist token creation and management

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  Keypair,
  SystemProgram,
} from '@solana/web3.js';
import { 
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  createSetAuthorityInstruction,
  AuthorityType,
} from '@solana/spl-token';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

export interface ArtistTokenConfig {
  name: string;
  symbol: string;
  decimals?: number;
  initialSupply: number;
  artistWallet: string;
  metadata?: {
    description?: string;
    image?: string;
    website?: string;
    twitter?: string;
  };
}

export interface TokenMintResult {
  mintAddress: string;
  transaction: Transaction;
  mintKeypair: Keypair;
}

/**
 * Create an artist token mint
 */
export async function createArtistTokenMint(
  config: ArtistTokenConfig
): Promise<TokenMintResult> {
  const connection = new Connection(RPC_ENDPOINT);
  const artistPubkey = new PublicKey(config.artistWallet);
  const decimals = config.decimals || 6;
  
  // Generate new mint keypair
  const mintKeypair = Keypair.generate();
  
  const transaction = new Transaction();
  
  // Get rent exemption
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  
  // Create mint account
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: artistPubkey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    })
  );
  
  // Initialize mint
  transaction.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      artistPubkey, // mint authority
      artistPubkey, // freeze authority (optional)
    )
  );
  
  // Create artist's token account
  const artistATA = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    artistPubkey
  );
  
  transaction.add(
    createAssociatedTokenAccountInstruction(
      artistPubkey,
      artistATA,
      artistPubkey,
      mintKeypair.publicKey
    )
  );
  
  // Mint initial supply to artist
  const initialSupplyWithDecimals = config.initialSupply * Math.pow(10, decimals);
  
  transaction.add(
    createMintToInstruction(
      mintKeypair.publicKey,
      artistATA,
      artistPubkey,
      initialSupplyWithDecimals
    )
  );
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = artistPubkey;
  
  return {
    mintAddress: mintKeypair.publicKey.toBase58(),
    transaction,
    mintKeypair,
  };
}

/**
 * Mint additional tokens (only by mint authority)
 */
export async function mintAdditionalTokens(
  mintAddress: string,
  recipientWallet: string,
  amount: number,
  decimals: number = 6
): Promise<Transaction> {
  const connection = new Connection(RPC_ENDPOINT);
  const mint = new PublicKey(mintAddress);
  const recipient = new PublicKey(recipientWallet);
  
  const recipientATA = await getAssociatedTokenAddress(mint, recipient);
  
  const transaction = new Transaction();
  
  // Check if ATA exists, create if needed
  const accountInfo = await connection.getAccountInfo(recipientATA);
  if (!accountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        recipient,
        recipientATA,
        recipient,
        mint
      )
    );
  }
  
  // Mint tokens
  const amountWithDecimals = amount * Math.pow(10, decimals);
  
  transaction.add(
    createMintToInstruction(
      mint,
      recipientATA,
      recipient, // This should be mint authority
      amountWithDecimals
    )
  );
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = recipient;
  
  return transaction;
}

/**
 * Disable minting (make supply fixed)
 */
export async function disableMinting(
  mintAddress: string,
  authorityWallet: string
): Promise<Transaction> {
  const mint = new PublicKey(mintAddress);
  const authority = new PublicKey(authorityWallet);
  
  const connection = new Connection(RPC_ENDPOINT);
  const transaction = new Transaction();
  
  // Set mint authority to null
  transaction.add(
    createSetAuthorityInstruction(
      mint,
      authority,
      AuthorityType.MintTokens,
      null
    )
  );
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = authority;
  
  return transaction;
}

/**
 * Get token holder count (simplified - would need indexer for full data)
 */
export async function getTokenHolderCount(mintAddress: string): Promise<number> {
  const connection = new Connection(RPC_ENDPOINT);
  const mint = new PublicKey(mintAddress);
  
  try {
    // Get largest token accounts (top 20)
    const accounts = await connection.getTokenLargestAccounts(mint);
    return accounts.value.filter(acc => acc.uiAmount && acc.uiAmount > 0).length;
  } catch {
    return 0;
  }
}

/**
 * Get token supply info
 */
export async function getTokenSupply(mintAddress: string): Promise<{
  totalSupply: number;
  decimals: number;
}> {
  const connection = new Connection(RPC_ENDPOINT);
  const mint = new PublicKey(mintAddress);
  
  const supply = await connection.getTokenSupply(mint);
  
  return {
    totalSupply: supply.value.uiAmount || 0,
    decimals: supply.value.decimals,
  };
}

/**
 * Get wallet's token balance
 */
export async function getTokenBalance(
  mintAddress: string,
  walletAddress: string
): Promise<number> {
  const connection = new Connection(RPC_ENDPOINT);
  const mint = new PublicKey(mintAddress);
  const wallet = new PublicKey(walletAddress);
  
  try {
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const balance = await connection.getTokenAccountBalance(ata);
    return balance.value.uiAmount || 0;
  } catch {
    return 0;
  }
}

/**
 * Transfer artist tokens
 */
export async function transferTokens(
  mintAddress: string,
  fromWallet: string,
  toWallet: string,
  amount: number,
  decimals: number = 6
): Promise<Transaction> {
  const connection = new Connection(RPC_ENDPOINT);
  const mint = new PublicKey(mintAddress);
  const from = new PublicKey(fromWallet);
  const to = new PublicKey(toWallet);
  
  const fromATA = await getAssociatedTokenAddress(mint, from);
  const toATA = await getAssociatedTokenAddress(mint, to);
  
  const transaction = new Transaction();
  
  // Create recipient ATA if needed
  const accountInfo = await connection.getAccountInfo(toATA);
  if (!accountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        from,
        toATA,
        to,
        mint
      )
    );
  }
  
  // Import transfer instruction
  const { createTransferInstruction } = await import('@solana/spl-token');
  
  const amountWithDecimals = amount * Math.pow(10, decimals);
  
  transaction.add(
    createTransferInstruction(
      fromATA,
      toATA,
      from,
      amountWithDecimals
    )
  );
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = from;
  
  return transaction;
}

// Predefined token tiers for artist tokens
export const ARTIST_TOKEN_TIERS = {
  BRONZE: {
    name: 'Bronze Fan',
    minTokens: 100,
    benefits: ['Early access to new releases', 'Fan badge'],
  },
  SILVER: {
    name: 'Silver Fan',
    minTokens: 1000,
    benefits: ['All Bronze benefits', 'Exclusive merch discounts', 'Monthly AMA access'],
  },
  GOLD: {
    name: 'Gold Fan',
    minTokens: 10000,
    benefits: ['All Silver benefits', 'VIP concert access', 'Private Discord channel'],
  },
  PLATINUM: {
    name: 'Platinum Fan',
    minTokens: 100000,
    benefits: ['All Gold benefits', 'Studio session invite', 'Album credits', 'Direct messaging'],
  },
};

/**
 * Get user's tier for an artist token
 */
export async function getUserTokenTier(
  mintAddress: string,
  walletAddress: string
): Promise<keyof typeof ARTIST_TOKEN_TIERS | null> {
  const balance = await getTokenBalance(mintAddress, walletAddress);
  
  if (balance >= ARTIST_TOKEN_TIERS.PLATINUM.minTokens) return 'PLATINUM';
  if (balance >= ARTIST_TOKEN_TIERS.GOLD.minTokens) return 'GOLD';
  if (balance >= ARTIST_TOKEN_TIERS.SILVER.minTokens) return 'SILVER';
  if (balance >= ARTIST_TOKEN_TIERS.BRONZE.minTokens) return 'BRONZE';
  
  return null;
}
