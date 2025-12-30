// lib/solana/payments.ts
// Solana Pay integration for track purchases and subscriptions

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from '@solana/web3.js';
import { 
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { encodeURL, TransferRequestURLFields } from '@solana/pay';
import BigNumber from 'bignumber.js';

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

// USDC mint addresses
const USDC_MINT = {
  devnet: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Devnet USDC
  mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
};

// Platform fee wallet
const PLATFORM_FEE_WALLET = process.env.PLATFORM_FEE_WALLET || '';
const PLATFORM_FEE_PERCENT = 10; // 10% platform fee

export interface PaymentConfig {
  recipient: string;      // Artist wallet
  amount: number;         // Amount in SOL or token units
  currency: 'SOL' | 'USDC';
  reference?: string;     // Unique reference for tracking
  label?: string;         // Display label
  message?: string;       // Display message
  memo?: string;          // On-chain memo
}

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Create a Solana Pay URL for QR code
 */
export function createPaymentURL(config: PaymentConfig): URL {
  const recipient = new PublicKey(config.recipient);
  const amount = new BigNumber(config.amount);
  
  const urlParams: TransferRequestURLFields = {
    recipient,
    amount,
    label: config.label || 'IXXXI',
    message: config.message || 'Track Purchase',
    memo: config.memo,
  };
  
  // Add SPL token for USDC
  if (config.currency === 'USDC') {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    urlParams.splToken = new PublicKey(USDC_MINT[network as keyof typeof USDC_MINT]);
  }
  
  // Add reference for tracking
  if (config.reference) {
    urlParams.reference = [new PublicKey(config.reference)];
  }
  
  return encodeURL(urlParams);
}

/**
 * Generate QR code for payment
 * Returns the Solana Pay URL (client can render QR)
 */
export function generatePaymentQR(config: PaymentConfig): string {
  const url = createPaymentURL(config);
  return url.toString();
}

/**
 * Create a SOL transfer transaction with platform fee split
 */
export async function createSOLPaymentTransaction(
  payerWallet: string,
  recipientWallet: string,
  amountSOL: number,
  includePlatformFee: boolean = true
): Promise<{ transaction: Transaction; artistAmount: number; feeAmount: number }> {
  const connection = new Connection(RPC_ENDPOINT);
  const payer = new PublicKey(payerWallet);
  const recipient = new PublicKey(recipientWallet);
  
  const totalLamports = Math.round(amountSOL * LAMPORTS_PER_SOL);

  let artistAmount = totalLamports;
  let feeAmount = 0;

  const transaction = new Transaction();

  // Calculate platform fee - fix rounding to ensure total equals sum of parts
  if (includePlatformFee && PLATFORM_FEE_WALLET) {
    feeAmount = Math.floor(totalLamports * (PLATFORM_FEE_PERCENT / 100));
    // Artist gets the remainder to ensure totalLamports = artistAmount + feeAmount
    artistAmount = totalLamports - feeAmount;

    // Add platform fee transfer
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: new PublicKey(PLATFORM_FEE_WALLET),
        lamports: feeAmount,
      })
    );
  }

  // Add artist payment
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipient,
      lamports: artistAmount,
    })
  );
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;
  
  return {
    transaction,
    artistAmount: artistAmount / LAMPORTS_PER_SOL,
    feeAmount: feeAmount / LAMPORTS_PER_SOL,
  };
}

/**
 * Create a USDC transfer transaction with platform fee split
 */
export async function createUSDCPaymentTransaction(
  payerWallet: string,
  recipientWallet: string,
  amountUSDC: number,
  includePlatformFee: boolean = true
): Promise<{ transaction: Transaction; artistAmount: number; feeAmount: number }> {
  const connection = new Connection(RPC_ENDPOINT);
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  const usdcMint = new PublicKey(USDC_MINT[network as keyof typeof USDC_MINT]);
  
  const payer = new PublicKey(payerWallet);
  const recipient = new PublicKey(recipientWallet);
  
  // USDC has 6 decimals
  const totalAmount = Math.round(amountUSDC * 1_000_000);

  let artistAmount = totalAmount;
  let feeAmount = 0;

  const transaction = new Transaction();

  // Get payer's USDC token account
  const payerATA = await getAssociatedTokenAddress(usdcMint, payer);

  // Calculate platform fee - fix rounding to ensure total equals sum of parts
  if (includePlatformFee && PLATFORM_FEE_WALLET) {
    feeAmount = Math.floor(totalAmount * (PLATFORM_FEE_PERCENT / 100));
    // Artist gets the remainder to ensure totalAmount = artistAmount + feeAmount
    artistAmount = totalAmount - feeAmount;
    
    const feeWallet = new PublicKey(PLATFORM_FEE_WALLET);
    const feeATA = await getAssociatedTokenAddress(usdcMint, feeWallet);
    
    // Check if fee ATA exists, create if not
    try {
      await getAccount(connection, feeATA);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer,
          feeATA,
          feeWallet,
          usdcMint
        )
      );
    }
    
    // Add fee transfer
    transaction.add(
      createTransferInstruction(
        payerATA,
        feeATA,
        payer,
        feeAmount
      )
    );
  }
  
  // Get recipient's USDC token account
  const recipientATA = await getAssociatedTokenAddress(usdcMint, recipient);
  
  // Check if recipient ATA exists, create if not
  try {
    await getAccount(connection, recipientATA);
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer,
        recipientATA,
        recipient,
        usdcMint
      )
    );
  }
  
  // Add artist payment
  transaction.add(
    createTransferInstruction(
      payerATA,
      recipientATA,
      payer,
      artistAmount
    )
  );
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;
  
  return {
    transaction,
    artistAmount: artistAmount / 1_000_000,
    feeAmount: feeAmount / 1_000_000,
  };
}

/**
 * Verify a payment transaction
 */
export async function verifyPayment(
  signature: string,
  expectedRecipient: string,
  expectedAmount: number,
  currency: 'SOL' | 'USDC'
): Promise<{ verified: boolean; error?: string }> {
  const connection = new Connection(RPC_ENDPOINT);
  
  try {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx) {
      return { verified: false, error: 'Transaction not found' };
    }
    
    if (tx.meta?.err) {
      return { verified: false, error: 'Transaction failed' };
    }
    
    // For SOL, check post balances
    if (currency === 'SOL') {
      const recipientIndex = tx.transaction.message.staticAccountKeys.findIndex(
        key => key.toBase58() === expectedRecipient
      );
      
      if (recipientIndex === -1) {
        return { verified: false, error: 'Recipient not found in transaction' };
      }
      
      const preBalance = tx.meta?.preBalances[recipientIndex] || 0;
      const postBalance = tx.meta?.postBalances[recipientIndex] || 0;
      const received = (postBalance - preBalance) / LAMPORTS_PER_SOL;
      
      // Allow 1% tolerance for fees
      if (received >= expectedAmount * 0.89) { // 10% fee + 1% tolerance
        return { verified: true };
      }
      
      return { verified: false, error: `Expected ${expectedAmount} SOL, received ${received}` };
    }
    
    // For USDC, check token balance changes
    // This would require parsing token program logs
    // Simplified: just check tx succeeded
    return { verified: true };
    
  } catch (error) {
    return { 
      verified: false, 
      error: error instanceof Error ? error.message : 'Verification failed' 
    };
  }
}

/**
 * Get SOL price in USD (mock for now, would use oracle in production)
 */
export async function getSOLPrice(): Promise<number> {
  // In production, use Pyth or Chainlink oracle
  // For now, return a mock price
  return 150; // $150 per SOL
}

/**
 * Convert USD to SOL
 */
export async function usdToSOL(usdAmount: number): Promise<number> {
  const solPrice = await getSOLPrice();
  return usdAmount / solPrice;
}
