// lib/solana/royalties.ts
// On-chain royalty distribution for track collaborators

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { 
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

// USDC mint addresses
const USDC_MINT = {
  devnet: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export interface RoyaltySplit {
  wallet: string;
  percentage: number; // 0-100
  role: string;       // e.g., "Artist", "Producer", "Songwriter"
  name?: string;
}

export interface RoyaltyConfig {
  trackId: string;
  splits: RoyaltySplit[];
  platformFeePercent?: number;
}

export interface RoyaltyDistribution {
  totalAmount: number;
  currency: 'SOL' | 'USDC';
  distributions: {
    wallet: string;
    amount: number;
    role: string;
  }[];
  platformFee: number;
}

/**
 * Validate royalty splits total 100%
 */
export function validateRoyaltySplits(splits: RoyaltySplit[]): { 
  valid: boolean; 
  error?: string 
} {
  const total = splits.reduce((sum, split) => sum + split.percentage, 0);
  
  if (total !== 100) {
    return { 
      valid: false, 
      error: `Royalty splits must total 100%, got ${total}%` 
    };
  }
  
  // Validate each split
  for (const split of splits) {
    if (split.percentage <= 0) {
      return { 
        valid: false, 
        error: 'Each split must be greater than 0%' 
      };
    }
    
    try {
      new PublicKey(split.wallet);
    } catch {
      return { 
        valid: false, 
        error: `Invalid wallet address: ${split.wallet}` 
      };
    }
  }
  
  return { valid: true };
}

/**
 * Calculate royalty distribution amounts
 */
export function calculateRoyaltyDistribution(
  totalAmount: number,
  splits: RoyaltySplit[],
  platformFeePercent: number = 10
): RoyaltyDistribution {
  // Calculate platform fee first
  const platformFee = totalAmount * (platformFeePercent / 100);
  const distributableAmount = totalAmount - platformFee;
  
  const distributions = splits.map(split => ({
    wallet: split.wallet,
    amount: distributableAmount * (split.percentage / 100),
    role: split.role,
  }));
  
  return {
    totalAmount,
    currency: 'SOL', // Default, can be overridden
    distributions,
    platformFee,
  };
}

/**
 * Create a SOL royalty distribution transaction
 */
export async function createSOLRoyaltyTransaction(
  payerWallet: string,
  totalAmountSOL: number,
  splits: RoyaltySplit[],
  platformFeeWallet?: string,
  platformFeePercent: number = 10
): Promise<Transaction> {
  const connection = new Connection(RPC_ENDPOINT);
  const payer = new PublicKey(payerWallet);
  
  const validation = validateRoyaltySplits(splits);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const totalLamports = Math.round(totalAmountSOL * LAMPORTS_PER_SOL);
  const transaction = new Transaction();
  
  // Calculate and add platform fee
  if (platformFeeWallet && platformFeePercent > 0) {
    const feeLamports = Math.round(totalLamports * (platformFeePercent / 100));
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: new PublicKey(platformFeeWallet),
        lamports: feeLamports,
      })
    );
  }
  
  // Calculate distributable amount
  const distributableLamports = Math.round(
    totalLamports * (1 - platformFeePercent / 100)
  );
  
  // Add transfers for each split
  for (const split of splits) {
    const recipientLamports = Math.round(
      distributableLamports * (split.percentage / 100)
    );
    
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: new PublicKey(split.wallet),
        lamports: recipientLamports,
      })
    );
  }
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;
  
  return transaction;
}

/**
 * Create a USDC royalty distribution transaction
 */
export async function createUSDCRoyaltyTransaction(
  payerWallet: string,
  totalAmountUSDC: number,
  splits: RoyaltySplit[],
  platformFeeWallet?: string,
  platformFeePercent: number = 10
): Promise<Transaction> {
  const connection = new Connection(RPC_ENDPOINT);
  const payer = new PublicKey(payerWallet);
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  const usdcMint = new PublicKey(USDC_MINT[network as keyof typeof USDC_MINT]);
  
  const validation = validateRoyaltySplits(splits);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // USDC has 6 decimals
  const totalAmount = Math.round(totalAmountUSDC * 1_000_000);
  const transaction = new Transaction();
  
  // Get payer's USDC account
  const payerATA = await getAssociatedTokenAddress(usdcMint, payer);
  
  // Platform fee
  if (platformFeeWallet && platformFeePercent > 0) {
    const feeWallet = new PublicKey(platformFeeWallet);
    const feeATA = await getAssociatedTokenAddress(usdcMint, feeWallet);
    const feeAmount = Math.round(totalAmount * (platformFeePercent / 100));
    
    // Create ATA if needed
    try {
      await getAccount(connection, feeATA);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(payer, feeATA, feeWallet, usdcMint)
      );
    }
    
    transaction.add(
      createTransferInstruction(payerATA, feeATA, payer, feeAmount)
    );
  }
  
  // Calculate distributable amount
  const distributableAmount = Math.round(totalAmount * (1 - platformFeePercent / 100));
  
  // Add transfers for each split
  for (const split of splits) {
    const recipient = new PublicKey(split.wallet);
    const recipientATA = await getAssociatedTokenAddress(usdcMint, recipient);
    const splitAmount = Math.round(distributableAmount * (split.percentage / 100));
    
    // Create ATA if needed
    try {
      await getAccount(connection, recipientATA);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(payer, recipientATA, recipient, usdcMint)
      );
    }
    
    transaction.add(
      createTransferInstruction(payerATA, recipientATA, payer, splitAmount)
    );
  }
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;
  
  return transaction;
}

/**
 * Parse royalty splits from string format "wallet:percentage:role"
 */
export function parseRoyaltySplits(splitStrings: string[]): RoyaltySplit[] {
  return splitStrings.map(str => {
    const [wallet, percentageStr, role] = str.split(':');
    return {
      wallet,
      percentage: parseFloat(percentageStr),
      role: role || 'Collaborator',
    };
  });
}

/**
 * Format royalty splits for display
 */
export function formatRoyaltySplits(splits: RoyaltySplit[]): string {
  return splits
    .map(s => `${s.role}: ${s.percentage}% → ${s.wallet.slice(0, 4)}...${s.wallet.slice(-4)}`)
    .join('\n');
}

/**
 * Store royalty config in metadata (for NFTs)
 */
export function encodeRoyaltyMetadata(config: RoyaltyConfig): string {
  return JSON.stringify({
    trackId: config.trackId,
    splits: config.splits.map(s => ({
      w: s.wallet,
      p: s.percentage,
      r: s.role,
    })),
  });
}

/**
 * Decode royalty config from metadata
 */
export function decodeRoyaltyMetadata(encoded: string): RoyaltyConfig | null {
  try {
    const data = JSON.parse(encoded);
    return {
      trackId: data.trackId,
      splits: data.splits.map((s: { w: string; p: number; r: string }) => ({
        wallet: s.w,
        percentage: s.p,
        role: s.r,
      })),
    };
  } catch {
    return null;
  }
}

// Predefined royalty templates
export const ROYALTY_TEMPLATES = {
  SOLO_ARTIST: [
    { wallet: '', percentage: 100, role: 'Artist' },
  ],
  PRODUCER_COLLAB: [
    { wallet: '', percentage: 50, role: 'Artist' },
    { wallet: '', percentage: 50, role: 'Producer' },
  ],
  BAND_SPLIT: [
    { wallet: '', percentage: 25, role: 'Vocalist' },
    { wallet: '', percentage: 25, role: 'Guitarist' },
    { wallet: '', percentage: 25, role: 'Bassist' },
    { wallet: '', percentage: 25, role: 'Drummer' },
  ],
  LABEL_DEAL: [
    { wallet: '', percentage: 70, role: 'Artist' },
    { wallet: '', percentage: 30, role: 'Label' },
  ],
};
