// hooks/useWeb3.ts
// React hooks for Solana Web3 interactions

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const IXXXI_TOKEN_MINT = process.env.NEXT_PUBLIC_IXXXI_TOKEN_MINT;

// ============ Types ============
interface TransactionRecord {
  signature: string;
  type: string;
  direction: 'sent' | 'received' | 'self';
  amount?: number;
  currency?: string;
  counterparty?: string;
  timestamp: number;
  status: string;
  trackId?: string;
  trackTitle?: string;
}

interface TierInfo {
  tier: string;
  tierName: string;
  tokenBalance: number;
  benefits: Record<string, unknown>;
  nextTier?: {
    tier: string;
    name: string;
    tokensRequired: number;
  };
}

interface PurchaseDetails {
  trackId: string;
  trackTitle: string;
  artist: string;
  priceUSD: number;
  currency: string;
  artistAmount: number;
  platformFee: number;
}

// ============ useSOLBalance ============
export function useSOLBalance() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    setLoading(true);
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Failed to fetch SOL balance:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}

// ============ useTokenBalance ============
export function useTokenBalance(mintAddress?: string) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const mint = mintAddress || IXXXI_TOKEN_MINT;

  const refresh = useCallback(async () => {
    if (!publicKey || !mint) {
      setBalance(0);
      return;
    }

    setLoading(true);
    try {
      const mintPubkey = new PublicKey(mint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      const account = await getAccount(connection, ata);
      // Assuming 6 decimals
      setBalance(Number(account.amount) / 1e6);
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, mint]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}

// ============ useUserTier ============
export function useUserTier() {
  const { publicKey } = useWallet();
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setTierInfo(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/user/tier?wallet=${publicKey.toBase58()}`);
      if (res.ok) {
        const data = await res.json();
        setTierInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch tier:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tierInfo, loading, refresh };
}

// ============ useTransactionHistory ============
export function useTransactionHistory(limit: number = 20) {
  const { publicKey } = useWallet();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (nextCursor?: string) => {
    if (!publicKey) return;

    setLoading(true);
    try {
      let url = `/api/user/transactions?wallet=${publicKey.toBase58()}&limit=${limit}`;
      if (nextCursor) {
        url += `&before=${nextCursor}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        
        if (nextCursor) {
          setTransactions(prev => [...prev, ...data.transactions]);
        } else {
          setTransactions(data.transactions);
        }
        
        setHasMore(data.pagination.hasMore);
        setCursor(data.pagination.nextCursor);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, limit]);

  const loadMore = useCallback(() => {
    if (hasMore && cursor) {
      fetchTransactions(cursor);
    }
  }, [hasMore, cursor, fetchTransactions]);

  const refresh = useCallback(() => {
    setCursor(null);
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    refresh();
  }, [publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { transactions, loading, hasMore, loadMore, refresh };
}

// ============ usePurchaseTrack ============
export function usePurchaseTrack() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(async (
    trackId: string,
    currency: 'SOL' | 'USDC' = 'SOL'
  ): Promise<{ success: boolean; signature?: string; details?: PurchaseDetails }> => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Get transaction from API
      const createRes = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          buyerWallet: publicKey.toBase58(),
          currency,
          action: 'create',
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || 'Failed to create transaction');
      }

      const { transaction: txBase64, details } = await createRes.json();

      // Deserialize and sign transaction
      const txBuffer = Buffer.from(txBase64, 'base64');
      const transaction = Transaction.from(txBuffer);
      
      const signedTx = await signTransaction(transaction);
      
      // Submit transaction
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Verify with API
      const verifyRes = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          buyerWallet: publicKey.toBase58(),
          currency,
          action: 'verify',
          signature,
        }),
      });

      if (!verifyRes.ok) {
        throw new Error('Payment verification failed');
      }

      return { success: true, signature, details };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Purchase failed';
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, connection]);

  return { purchase, loading, error };
}

// ============ useMintNFT ============
export function useMintNFT() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mint = useCallback(async (
    trackId: string,
    editionSize: number = 100
  ): Promise<{ success: boolean; mintAddress?: string }> => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          artistWallet: publicKey.toBase58(),
          editionSize,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to mint NFT');
      }

      const data = await res.json();

      // If transaction needs signing
      if (data.transaction) {
        const txBuffer = Buffer.from(data.transaction, 'base64');
        const transaction = Transaction.from(txBuffer);
        
        const signedTx = await signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
      }

      return { success: true, mintAddress: data.nftMint };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Minting failed';
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, connection]);

  return { mint, loading, error };
}

// ============ useCreateArtistToken ============
export function useCreateArtistToken() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (
    artistId: string,
    tokenName: string,
    tokenSymbol: string,
    initialSupply: number = 1000000
  ): Promise<{ success: boolean; tokenMint?: string }> => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/artist/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          artistWallet: publicKey.toBase58(),
          tokenName,
          tokenSymbol,
          initialSupply,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create token');
      }

      const data = await res.json();

      // Sign and submit transaction
      if (data.transaction) {
        const txBuffer = Buffer.from(data.transaction, 'base64');
        const transaction = Transaction.from(txBuffer);
        
        // Also need to sign with mint keypair
        // This is handled differently in production (server-side)
        
        const signedTx = await signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
      }

      return { success: true, tokenMint: data.tokenMint };

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token creation failed';
      setError(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction, connection]);

  return { create, loading, error };
}

// ============ useCheckPurchase ============
export function useCheckPurchase(trackId: string) {
  const { publicKey } = useWallet();
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    if (!publicKey || !trackId) {
      setPurchased(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/purchase?trackId=${trackId}&wallet=${publicKey.toBase58()}`
      );
      if (res.ok) {
        const data = await res.json();
        setPurchased(data.purchased);
      }
    } catch {
      setPurchased(false);
    } finally {
      setLoading(false);
    }
  }, [publicKey, trackId]);

  useEffect(() => {
    check();
  }, [check]);

  return { purchased, loading, refresh: check };
}
