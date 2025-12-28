// context/UserContext.tsx
// Global user state management - auto-creates profile on wallet connect

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface Artist {
  id: string;
  name: string;
  isVerified: boolean;
}

interface User {
  id: string;
  walletAddress: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: 'listener' | 'artist' | 'admin';
  tier: 'free' | 'holder' | 'premium' | 'whale';
  tokenBalance: number;
  createdAt: string;
  lastSeenAt: string;
  artist: Artist | null;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isArtist: boolean;
  isVerifiedArtist: boolean;
  tier: string;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: false,
  error: null,
  isArtist: false,
  isVerifiedArtist: false,
  tier: 'free',
  refreshUser: async () => {},
  updateProfile: async () => false,
});

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, connecting } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch or create user profile
  const fetchUser = useCallback(async (walletAddress: string) => {
    setLoading(true);
    setError(null);

    try {
      // Try to get existing user
      const getRes = await fetch(`/api/user?wallet=${walletAddress}`);
      
      if (getRes.ok) {
        const userData = await getRes.json();
        setUser(userData);
        return;
      }

      // User doesn't exist, create new profile
      if (getRes.status === 404) {
        const createRes = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        });

        if (createRes.ok) {
          const newUser = await createRes.json();
          setUser(newUser);
          return;
        }
      }

      throw new Error('Failed to load user profile');
    } catch (err) {
      console.error('User fetch error:', err);
      setError('Failed to load profile');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Watch wallet connection
  useEffect(() => {
    if (connected && publicKey) {
      fetchUser(publicKey.toBase58());
    } else if (!connected && !connecting) {
      setUser(null);
      setError(null);
    }
  }, [connected, connecting, publicKey, fetchUser]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (publicKey) {
      await fetchUser(publicKey.toBase58());
    }
  }, [publicKey, fetchUser]);

  // Update user profile
  const updateProfile = useCallback(async (data: Partial<User>): Promise<boolean> => {
    if (!publicKey) return false;

    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          ...data,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Profile update error:', err);
      return false;
    }
  }, [publicKey]);

  const value: UserContextType = {
    user,
    loading: loading || connecting,
    error,
    isArtist: user?.role === 'artist' || user?.artist !== null,
    isVerifiedArtist: user?.artist?.isVerified ?? false,
    tier: user?.tier ?? 'free',
    refreshUser,
    updateProfile,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}
