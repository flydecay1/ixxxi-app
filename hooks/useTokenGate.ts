import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';

export function useTokenGate(tokenMintAddress: string) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [hasAccess, setHasAccess] = useState(false);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey || !tokenMintAddress) {
      setHasAccess(false);
      setBalance(0);
      return;
    }

    const checkBalance = async () => {
      setLoading(true);
      try {
        const mint = new PublicKey(tokenMintAddress);
        
        // Get all token accounts for this mint
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: mint,
        });

        let totalBalance = 0;
        for (const account of tokenAccounts.value) {
          const parsedInfo = account.account.data.parsed.info;
          totalBalance += parsedInfo.tokenAmount.uiAmount;
        }

        setBalance(totalBalance);
        setHasAccess(totalBalance > 0);
      } catch (error) {
        console.error("Error checking token balance:", error);
        setHasAccess(false);
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };

    checkBalance();
  }, [connection, publicKey, tokenMintAddress]);

  return { hasAccess, balance, loading };
}
