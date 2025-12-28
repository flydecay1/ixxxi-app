// hooks/usePremium.ts
// React hooks for premium features

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

// Types
interface HistoryEntry {
  id: string;
  track: {
    id: string;
    title: string;
    ticker: string;
    coverUrl: string | null;
    duration: number | null;
    artist: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  };
  duration: number;
  completed: boolean;
  playedAt: string;
}

interface Recommendation {
  id: string;
  title: string;
  ticker: string;
  coverUrl: string | null;
  duration: number | null;
  playCount: number;
  likeCount: number;
  artist: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  reason?: string;
  score?: number;
}

interface Download {
  id: string;
  track: {
    id: string;
    title: string;
    ticker: string;
    coverUrl: string | null;
    duration: number | null;
    artist: {
      id: string;
      name: string;
    };
  };
  quality: string;
  fileSize: number;
  downloadedAt: string;
  expiresAt: string;
}

interface EarlyAccessTrack {
  id: string;
  title: string;
  ticker: string;
  coverUrl: string | null;
  duration: number | null;
  scheduledReleaseAt: string;
  artist: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  availableNow: boolean;
  daysUntilAccess?: number;
  requiredTierForNow?: string;
}

interface ExclusiveContent {
  accessible: ExclusiveTrack[];
  locked: ExclusiveTrack[];
}

interface ExclusiveTrack {
  id: string;
  title: string;
  ticker: string;
  coverUrl: string | null;
  requiredTier: string;
  canAccess: boolean;
  tokensNeeded?: number;
  artist: {
    id: string;
    name: string;
  };
}

// Listening History Hook
export function useListeningHistory(userId?: string) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<{
    totalPlays: number;
    totalDuration: number;
    uniqueTracks: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (period: 'today' | 'week' | 'month' | 'all' = 'all') => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/history?userId=${userId}&period=${period}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setHistory(data.history);
      setRecentlyPlayed(data.recentlyPlayed);
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const recordPlay = useCallback(async (trackId: string, duration: number, completed: boolean) => {
    if (!userId) return;

    try {
      await fetch('/api/user/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trackId, duration, completed }),
      });
    } catch (err) {
      console.error('Failed to record play:', err);
    }
  }, [userId]);

  const clearHistory = useCallback(async (trackId?: string) => {
    if (!userId) return;

    try {
      await fetch('/api/user/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trackId }),
      });
      await fetchHistory();
    } catch (err: any) {
      setError(err.message);
    }
  }, [userId, fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    recentlyPlayed,
    stats,
    loading,
    error,
    fetchHistory,
    recordPlay,
    clearHistory,
  };
}

// Recommendations Hook
export function useRecommendations(userId?: string) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async (
    type: 'mixed' | 'similar' | 'trending' | 'new' | 'genre' = 'mixed',
    options?: { genre?: string; limit?: number; exclude?: string[] }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      params.set('type', type);
      if (options?.genre) params.set('genre', options.genre);
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.exclude?.length) params.set('exclude', options.exclude.join(','));

      const response = await fetch(`/api/recommendations?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setRecommendations(data.recommendations);
      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    fetchRecommendations,
    getTrending: () => fetchRecommendations('trending'),
    getNew: () => fetchRecommendations('new'),
    getSimilar: () => fetchRecommendations('similar'),
    getByGenre: (genre: string) => fetchRecommendations('genre', { genre }),
  };
}

// Downloads Hook
export function useDownloads() {
  const { publicKey } = useWallet();
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [stats, setStats] = useState<{ totalDownloads: number; totalSize: number; formattedSize: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDownloads = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/download?userId=${userId}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setDownloads(data.downloads);
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadTrack = useCallback(async (
    trackId: string, 
    quality: 'standard' | 'lossless' = 'standard'
  ) => {
    if (!publicKey) throw new Error('Wallet not connected');

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          trackId,
          quality,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message);
      }

      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  const removeDownload = useCallback(async (downloadId?: string) => {
    if (!publicKey) return;

    try {
      await fetch('/api/download', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          downloadId,
        }),
      });
    } catch (err: any) {
      setError(err.message);
    }
  }, [publicKey]);

  return {
    downloads,
    stats,
    loading,
    error,
    fetchDownloads,
    downloadTrack,
    removeDownload,
  };
}

// Early Access Hook
export function useEarlyAccess() {
  const { publicKey } = useWallet();
  const [earlyAccess, setEarlyAccess] = useState<EarlyAccessTrack[]>([]);
  const [upcoming, setUpcoming] = useState<EarlyAccessTrack[]>([]);
  const [userTier, setUserTier] = useState<string>('free');
  const [daysEarly, setDaysEarly] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEarlyAccess = useCallback(async (artistId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (publicKey) params.set('wallet', publicKey.toString());
      if (artistId) params.set('artistId', artistId);

      const response = await fetch(`/api/early-access?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setEarlyAccess(data.earlyAccess);
      setUpcoming(data.upcoming);
      setUserTier(data.tier);
      setDaysEarly(data.daysEarly);

      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  const scheduleRelease = useCallback(async (
    trackId: string, 
    scheduledReleaseAt: Date,
    earlyAccessDays?: number
  ) => {
    if (!publicKey) throw new Error('Wallet not connected');

    try {
      const response = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          trackId,
          scheduledReleaseAt: scheduledReleaseAt.toISOString(),
          earlyAccessDays,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [publicKey]);

  const cancelRelease = useCallback(async (trackId: string) => {
    if (!publicKey) throw new Error('Wallet not connected');

    try {
      const response = await fetch('/api/early-access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          trackId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [publicKey]);

  useEffect(() => {
    fetchEarlyAccess();
  }, [fetchEarlyAccess]);

  return {
    earlyAccess,
    upcoming,
    userTier,
    daysEarly,
    loading,
    error,
    fetchEarlyAccess,
    scheduleRelease,
    cancelRelease,
  };
}

// Exclusive Content Hook
export function useExclusiveContent() {
  const { publicKey } = useWallet();
  const [content, setContent] = useState<ExclusiveContent>({ accessible: [], locked: [] });
  const [userTier, setUserTier] = useState<string>('free');
  const [tokenBalance, setTokenBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExclusiveContent = useCallback(async (artistId?: string, tier?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (publicKey) params.set('wallet', publicKey.toString());
      if (artistId) params.set('artistId', artistId);
      if (tier) params.set('tier', tier);

      const response = await fetch(`/api/exclusive?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setContent(data.content);
      setUserTier(data.userTier);
      setTokenBalance(data.tokenBalance);

      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  const setExclusive = useCallback(async (
    trackId: string, 
    requiredTier: 'free' | 'holder' | 'premium' | 'whale',
    isExclusive = true
  ) => {
    if (!publicKey) throw new Error('Wallet not connected');

    try {
      const response = await fetch('/api/exclusive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          trackId,
          requiredTier,
          isExclusive,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [publicKey]);

  const updateTier = useCallback(async (trackId: string, requiredTier: string) => {
    if (!publicKey) throw new Error('Wallet not connected');

    try {
      const response = await fetch('/api/exclusive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          trackId,
          requiredTier,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [publicKey]);

  useEffect(() => {
    fetchExclusiveContent();
  }, [fetchExclusiveContent]);

  return {
    content,
    accessible: content.accessible,
    locked: content.locked,
    userTier,
    tokenBalance,
    loading,
    error,
    fetchExclusiveContent,
    setExclusive,
    updateTier,
  };
}

// User Stats Hook
export function useUserStats(userId?: string) {
  const [stats, setStats] = useState<{
    totalPlays: number;
    totalListenTime: number;
    uniqueArtists: number;
    uniqueTracks: number;
    favoriteGenres: { genre: string; plays: number }[];
    topArtists: { artistId: string; name: string; plays: number }[];
    streak: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (period: 'week' | 'month' | 'year' | 'all' = 'all') => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/stats?userId=${userId}&period=${period}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setStats(data);
      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
}
