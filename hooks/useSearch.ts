// hooks/useSearch.ts
// React hooks for search and discovery features

import { useState, useCallback, useEffect, useRef } from 'react';

// Types
interface SearchResult {
  id: string;
  type: 'track' | 'artist' | 'playlist' | 'user';
  title?: string;
  name?: string;
  ticker?: string;
  coverUrl?: string;
  avatarUrl?: string;
  artist?: { name: string; isVerified: boolean };
  playCount?: number;
  trackCount?: number;
  isVerified?: boolean;
}

interface SearchResults {
  tracks: SearchResult[];
  artists: SearchResult[];
  playlists: SearchResult[];
  users: SearchResult[];
  total: number;
}

interface Genre {
  name: string;
  trackCount: number;
  totalPlays: number;
  color: string;
  icon: string;
}

interface RadioTrack {
  position: number;
  id: string;
  title: string;
  ticker: string;
  coverUrl: string | null;
  duration: number | null;
  genre: string | null;
  bpm: number | null;
  artist: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
}

// Search Hook with debouncing
export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const search = useCallback(async (
    searchQuery: string,
    options?: {
      type?: 'all' | 'tracks' | 'artists' | 'playlists' | 'users';
      genre?: string;
      sort?: 'relevance' | 'recent' | 'popular';
      limit?: number;
      offset?: number;
    }
  ) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      if (options?.type) params.set('type', options.type);
      if (options?.genre) params.set('genre', options.genre);
      if (options?.sort) params.set('sort', options.sort);
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.offset) params.set('offset', options.offset.toString());

      const response = await fetch(`/api/search?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setResults(data.results);
      return data;
    } catch (err: any) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  const debouncedSearch = useCallback((searchQuery: string, options?: Parameters<typeof search>[1]) => {
    setQuery(searchQuery);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      search(searchQuery, options);
    }, 300);
  }, [search]);

  // Clear results
  const clear = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    query,
    results,
    loading,
    error,
    search,
    debouncedSearch,
    clear,
    hasResults: results && results.total > 0,
  };
}

// Genre Browsing Hook
export function useGenres() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [featured, setFeatured] = useState<Genre[]>([]);
  const [highlights, setHighlights] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGenres = useCallback(async (options?: { featured?: boolean; stats?: boolean }) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.featured) params.set('featured', 'true');
      if (options?.stats === false) params.set('stats', 'false');

      const response = await fetch(`/api/genres?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setGenres(data.genres || []);
      setFeatured(data.featured || []);
      setHighlights(data.highlights || {});
      
      return data;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  return {
    genres,
    featured,
    highlights,
    loading,
    error,
    refresh: fetchGenres,
  };
}

// Radio Mode Hook
export function useRadio() {
  const [tracks, setTracks] = useState<RadioTrack[]>([]);
  const [seed, setSeed] = useState<{
    type: string;
    id: string | null;
    genre: string | null;
    mood: string | null;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRadio = useCallback(async (options: {
    type?: 'track' | 'artist' | 'genre' | 'mood';
    seedId?: string;
    genre?: string;
    mood?: 'energetic' | 'chill' | 'focus' | 'party';
    limit?: number;
    exclude?: string[];
  }) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.type) params.set('type', options.type);
      if (options.seedId) params.set('seedId', options.seedId);
      if (options.genre) params.set('genre', options.genre);
      if (options.mood) params.set('mood', options.mood);
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.exclude?.length) params.set('exclude', options.exclude.join(','));

      const response = await fetch(`/api/radio?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setTracks(data.radio.tracks);
      setSeed(data.radio.seed);
      
      return data.radio;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Convenience methods
  const startFromTrack = useCallback((trackId: string) => 
    generateRadio({ type: 'track', seedId: trackId }), [generateRadio]);

  const startFromArtist = useCallback((artistId: string) => 
    generateRadio({ type: 'artist', seedId: artistId }), [generateRadio]);

  const startFromGenre = useCallback((genre: string) => 
    generateRadio({ type: 'genre', genre }), [generateRadio]);

  const startFromMood = useCallback((mood: 'energetic' | 'chill' | 'focus' | 'party') => 
    generateRadio({ type: 'mood', mood }), [generateRadio]);

  // Add more tracks to the queue
  const loadMore = useCallback(async () => {
    if (!seed) return;
    
    const currentIds = tracks.map(t => t.id);
    return generateRadio({
      type: seed.type as any,
      seedId: seed.id || undefined,
      genre: seed.genre || undefined,
      mood: seed.mood as any,
      exclude: currentIds,
    });
  }, [seed, tracks, generateRadio]);

  return {
    tracks,
    seed,
    loading,
    error,
    generateRadio,
    startFromTrack,
    startFromArtist,
    startFromGenre,
    startFromMood,
    loadMore,
    isActive: tracks.length > 0,
  };
}

// Trending Hook
export function useTrending() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/realtime?type=platform');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setTracks(data.trending?.tracks || []);
      setArtists(data.trending?.artists || []);
      
      return data.trending;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchTrending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrending]);

  return {
    tracks,
    artists,
    loading,
    error,
    refresh: fetchTrending,
  };
}
