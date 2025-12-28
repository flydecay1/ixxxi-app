// hooks/useAnalytics.ts
// React hooks for analytics features

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

// Types
interface TrackPerformance {
  id: string;
  title: string;
  ticker: string;
  coverUrl: string | null;
  plays: number;
  uniqueListeners: number;
  completionRate: number;
  avgListenDuration: number;
  totalRevenue: number;
  likes: number;
  stakes: number;
}

interface ArtistDashboard {
  artist: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isVerified: boolean;
    totalTracks: number;
    publishedTracks: number;
  };
  metrics: {
    totalPlays: number;
    playGrowth: number;
    uniqueListeners: number;
    totalListenTime: number;
    formattedListenTime: string;
    completionRate: number;
    followerCount: number;
    newFollowers: number;
    averagePlaysPerTrack: number;
  };
  revenue: {
    total: number;
    purchases: number;
    platformFees: number;
    byTrack: { trackId: string; revenue: number; sales: number }[];
  };
  trackPerformance: TrackPerformance[];
  audience: {
    tierBreakdown: Record<string, number>;
    tierPercentages: Record<string, number>;
    genreBreakdown: { genre: string; plays: number }[];
    peakHours: { hour: number; label: string; plays: number }[];
  };
  chartData: { date: string; label: string; plays: number; listeners: number; listenTime: number }[];
}

interface RealtimeMetrics {
  currentListeners: number;
  playsLastHour: number;
  playsLast24h: number;
  velocity: {
    status: 'surging' | 'rising' | 'stable' | 'declining';
    percentage: number;
  };
}

interface RevenueData {
  summary: {
    totalRevenue: number;
    totalSales: number;
    platformFees: number;
    purchaseCount: number;
    avgTransactionValue: number;
    avgDailyRevenue: number;
    revenueGrowth: number;
  };
  byCurrency: Record<string, { total: number; count: number }>;
  topTracks: {
    track: { id: string; title: string; ticker: string };
    revenue: number;
    sales: number;
  }[];
  chartData: { date: string; label: string; revenue: number; sales: number; purchases: number }[];
  recentTransactions: {
    id: string;
    type: string;
    amount: number;
    currency: string;
    track: { id: string; title: string; ticker: string };
    date: string;
  }[];
}

interface AudienceInsights {
  overview: {
    totalListeners: number;
    newListeners: number;
    returningListeners: number;
    retentionRate: number;
    avgDailyListeners: number;
  };
  demographics: {
    tierBreakdown: Record<string, { count: number; plays: number; avgPlays: number }>;
    tierPercentages: Record<string, number>;
    tokenHolderCount: number;
    avgTokenBalance: number;
  };
  engagement: {
    playCountGroups: Record<string, number>;
    engagementBreakdown: Record<string, number>;
  };
  listeningPatterns: {
    peakListeningHours: { hour: number; label: string; plays: number; percentage: number }[];
    dayOfWeekStats: { day: string; shortDay: string; plays: number; percentage: number }[];
    topGenres: { genre: string; plays: number; percentage: number }[];
  };
}

// Artist Dashboard Hook
export function useArtistDashboard() {
  const { publicKey } = useWallet();
  const [dashboard, setDashboard] = useState<ArtistDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (period: '7d' | '30d' | '90d' | '1y' | 'all' = '30d') => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/analytics/artist?wallet=${publicKey.toString()}&period=${period}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setDashboard(data);
      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      fetchDashboard();
    }
  }, [publicKey, fetchDashboard]);

  return {
    dashboard,
    loading,
    error,
    fetchDashboard,
    refresh: () => fetchDashboard(),
  };
}

// Realtime Metrics Hook
export function useRealtimeMetrics(options?: {
  type?: 'platform' | 'artist' | 'track';
  artistId?: string;
  trackId?: string;
  refreshInterval?: number;
}) {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [trending, setTrending] = useState<{
    tracks: any[];
    artists: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('type', options?.type || 'platform');
      if (options?.artistId) params.set('artistId', options.artistId);
      if (options?.trackId) params.set('trackId', options.trackId);

      const response = await fetch(`/api/analytics/realtime?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setMetrics(data.realtime);
      if (data.trending) setTrending(data.trending);
      
      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options?.type, options?.artistId, options?.trackId]);

  useEffect(() => {
    fetchMetrics();

    // Auto-refresh
    const interval = setInterval(fetchMetrics, options?.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics, options?.refreshInterval]);

  return {
    metrics,
    trending,
    loading,
    error,
    refresh: fetchMetrics,
  };
}

// Revenue Analytics Hook
export function useRevenueAnalytics() {
  const { publicKey } = useWallet();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async (
    period: '7d' | '30d' | '90d' | '1y' | 'all' = '30d',
    groupBy: 'day' | 'week' | 'month' = 'day'
  ) => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/analytics/revenue?wallet=${publicKey.toString()}&period=${period}&groupBy=${groupBy}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setRevenue(data);
      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      fetchRevenue();
    }
  }, [publicKey, fetchRevenue]);

  return {
    revenue,
    loading,
    error,
    fetchRevenue,
    summary: revenue?.summary,
    chartData: revenue?.chartData,
    recentTransactions: revenue?.recentTransactions,
  };
}

// Audience Insights Hook
export function useAudienceInsights(artistId?: string) {
  const { publicKey } = useWallet();
  const [insights, setInsights] = useState<AudienceInsights | null>(null);
  const [dailyActiveListeners, setDailyActiveListeners] = useState<
    { date: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async (period: '7d' | '30d' | '90d' | '1y' | 'all' = '30d') => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (artistId) params.set('artistId', artistId);
      else if (publicKey) params.set('wallet', publicKey.toString());
      params.set('period', period);

      const response = await fetch(`/api/analytics/audience?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setInsights({
        overview: data.overview,
        demographics: data.demographics,
        engagement: data.engagement,
        listeningPatterns: data.listeningPatterns,
      });
      setDailyActiveListeners(data.dailyActiveListeners);

      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [artistId, publicKey]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    dailyActiveListeners,
    loading,
    error,
    fetchInsights,
    overview: insights?.overview,
    demographics: insights?.demographics,
    engagement: insights?.engagement,
    listeningPatterns: insights?.listeningPatterns,
  };
}

// Platform Analytics Hook (Admin)
export function usePlatformAnalytics(adminKey?: string) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (period: '7d' | '30d' | '90d' | '1y' | 'all' = '30d') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/platform?period=${period}`, {
        headers: adminKey ? { 'x-admin-key': adminKey } : {},
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setAnalytics(data);
      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    fetchAnalytics,
    overview: analytics?.overview,
    growth: analytics?.growth,
    revenue: analytics?.revenue,
    userTiers: analytics?.userTiers,
    topTracks: analytics?.topTracks,
    topArtists: analytics?.topArtists,
    chartData: analytics?.chartData,
    systemHealth: analytics?.systemHealth,
  };
}

// Track Analytics Hook
export function useTrackAnalytics(trackId: string) {
  const [analytics, setAnalytics] = useState<{
    plays: number;
    uniqueListeners: number;
    completionRate: number;
    avgListenDuration: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    chartData: { date: string; plays: number }[];
  } | null>(null);
  const [realtime, setRealtime] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!trackId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch realtime metrics for the track
      const response = await fetch(`/api/analytics/realtime?type=track&trackId=${trackId}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setRealtime(data.realtime);

      // Note: Full track analytics would need a separate endpoint
      // This is a simplified version using realtime data

      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    fetchAnalytics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  return {
    analytics,
    realtime,
    loading,
    error,
    refresh: fetchAnalytics,
  };
}
