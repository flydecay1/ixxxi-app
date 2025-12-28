// context/AuthContext.tsx
// Unified authentication - supports both email (Web2) and wallet (Web3) login

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface User {
  id: string;
  walletAddress: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  tier: 'free' | 'holder' | 'premium' | 'whale';
  role: 'listener' | 'artist' | 'admin';
  isArtist: boolean;
  authMethod: 'email' | 'wallet';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  authMethod: 'email' | 'wallet' | null;
  
  // Actions
  loginWithEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyCode: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  loginWithWallet: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  authMethod: null,
  loginWithEmail: async () => ({ success: false }),
  verifyCode: async () => ({ success: false }),
  loginWithWallet: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'email' | 'wallet' | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  // Handle wallet connection changes
  useEffect(() => {
    if (wallet.connected && wallet.publicKey && !user) {
      // Wallet connected but no user - try to fetch/create user
      handleWalletAuth(wallet.publicKey.toBase58());
    } else if (!wallet.connected && authMethod === 'wallet') {
      // Wallet disconnected - clear user if auth was via wallet
      setUser(null);
      setAuthMethod(null);
    }
  }, [wallet.connected, wallet.publicKey]);

  const checkSession = async () => {
    try {
      // Check for user cookie (set by email auth)
      const userCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='));
      
      if (userCookie) {
        const userData = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
        setUser({ ...userData, authMethod: 'email' });
        setAuthMethod('email');
      }
    } catch (err) {
      console.error('Session check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletAuth = async (walletAddress: string) => {
    try {
      // Create or fetch user for this wallet
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      if (res.ok) {
        const userData = await res.json();
        setUser({
          id: userData.id,
          walletAddress: userData.walletAddress,
          username: userData.username,
          email: userData.email,
          avatarUrl: userData.avatarUrl,
          tier: userData.tier,
          role: userData.role,
          isArtist: !!userData.artist,
          authMethod: 'wallet',
        });
        setAuthMethod('wallet');
      }
    } catch (err) {
      console.error('Wallet auth error:', err);
    }
  };

  const loginWithEmail = useCallback(async (email: string) => {
    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'signin' }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error };
      }

      return { success: true, devCode: data.devCode };
    } catch (err) {
      return { success: false, error: 'Failed to send code' };
    }
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error };
      }

      // Set user from response
      setUser({
        ...data.user,
        authMethod: 'email',
      });
      setAuthMethod('email');

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Verification failed' };
    }
  }, []);

  const loginWithWallet = useCallback(async () => {
    try {
      if (!wallet.publicKey) {
        // Trigger wallet connection
        await wallet.connect();
        return { success: true };
      }

      await handleWalletAuth(wallet.publicKey.toBase58());
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Failed to connect wallet' };
    }
  }, [wallet]);

  const logout = useCallback(async () => {
    // Clear cookies
    document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    
    // Disconnect wallet if connected
    if (wallet.connected) {
      await wallet.disconnect();
    }

    setUser(null);
    setAuthMethod(null);
  }, [wallet]);

  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(`/api/user?wallet=${user.walletAddress}`);
      if (res.ok) {
        const userData = await res.json();
        setUser(prev => prev ? {
          ...prev,
          ...userData,
          isArtist: !!userData.artist,
        } : null);
      }
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      authMethod,
      loginWithEmail,
      verifyCode,
      loginWithWallet,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
