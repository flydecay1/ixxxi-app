// hooks/useLyrics.ts
// Hook for synced lyrics display

import { useState, useEffect, useCallback, useRef } from 'react';

interface LyricLine {
  time: number;
  duration?: number;
  text: string;
}

interface LyricsData {
  trackId: string;
  format: 'plain' | 'synced' | 'word-synced';
  language: string;
  lines: LyricLine[];
  translation?: {
    language: string;
    lines: LyricLine[];
  };
  credits?: {
    writer?: string;
    source?: string;
  };
}

export function useLyrics(trackId: string | null, currentTime: number = 0) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [currentLine, setCurrentLine] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  
  // Cache for fetched lyrics
  const lyricsCache = useRef<Map<string, LyricsData>>(new Map());

  // Fetch lyrics
  const fetchLyrics = useCallback(async (id: string) => {
    // Check cache first
    if (lyricsCache.current.has(id)) {
      setLyrics(lyricsCache.current.get(id)!);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/track/${id}/lyrics`);
      
      if (res.status === 404) {
        setLyrics(null);
        setError(null); // No lyrics is not an error
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch lyrics');
      }

      const data: LyricsData = await res.json();
      lyricsCache.current.set(id, data);
      setLyrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lyrics');
      setLyrics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when track changes
  useEffect(() => {
    if (trackId) {
      fetchLyrics(trackId);
      setCurrentLine(-1);
    } else {
      setLyrics(null);
      setCurrentLine(-1);
    }
  }, [trackId, fetchLyrics]);

  // Update current line based on playback time
  useEffect(() => {
    if (!lyrics || lyrics.format === 'plain' || !lyrics.lines.length) {
      return;
    }

    const lines = showTranslation && lyrics.translation 
      ? lyrics.translation.lines 
      : lyrics.lines;

    // Find current line based on time
    let lineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      
      if (currentTime >= line.time) {
        if (!nextLine || currentTime < nextLine.time) {
          lineIndex = i;
          break;
        }
      }
    }

    setCurrentLine(lineIndex);
  }, [currentTime, lyrics, showTranslation]);

  // Get lines to display (with context)
  const getVisibleLines = useCallback((range: number = 3): LyricLine[] => {
    if (!lyrics?.lines) return [];
    
    const lines = showTranslation && lyrics.translation 
      ? lyrics.translation.lines 
      : lyrics.lines;
    
    if (currentLine < 0) return lines.slice(0, range * 2 + 1);
    
    const start = Math.max(0, currentLine - range);
    const end = Math.min(lines.length, currentLine + range + 1);
    
    return lines.slice(start, end);
  }, [lyrics, currentLine, showTranslation]);

  // Jump to time by clicking a lyric line
  const seekToLine = useCallback((lineIndex: number): number | null => {
    if (!lyrics?.lines || lineIndex < 0 || lineIndex >= lyrics.lines.length) {
      return null;
    }
    
    const lines = showTranslation && lyrics.translation 
      ? lyrics.translation.lines 
      : lyrics.lines;
    
    return lines[lineIndex]?.time ?? null;
  }, [lyrics, showTranslation]);

  // Toggle translation
  const toggleTranslation = useCallback(() => {
    if (lyrics?.translation) {
      setShowTranslation(prev => !prev);
    }
  }, [lyrics]);

  // Get progress through current line (0-1)
  const getLineProgress = useCallback((): number => {
    if (!lyrics?.lines || currentLine < 0) return 0;
    
    const lines = showTranslation && lyrics.translation 
      ? lyrics.translation.lines 
      : lyrics.lines;
    
    const line = lines[currentLine];
    const nextLine = lines[currentLine + 1];
    
    if (!line) return 0;
    
    const lineDuration = line.duration || 
      (nextLine ? nextLine.time - line.time : 5);
    
    const elapsed = currentTime - line.time;
    return Math.min(1, Math.max(0, elapsed / lineDuration));
  }, [lyrics, currentLine, currentTime, showTranslation]);

  return {
    lyrics,
    currentLine,
    loading,
    error,
    hasLyrics: !!lyrics,
    isSynced: lyrics?.format === 'synced' || lyrics?.format === 'word-synced',
    hasTranslation: !!lyrics?.translation,
    showTranslation,
    toggleTranslation,
    getVisibleLines,
    seekToLine,
    getLineProgress,
    refresh: () => trackId && fetchLyrics(trackId),
  };
}

// Helper to parse LRC format lyrics
export function parseLRC(lrcContent: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const lrcLines = lrcContent.split('\n');
  
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  
  for (const line of lrcLines) {
    const matches = [...line.matchAll(timeRegex)];
    const text = line.replace(timeRegex, '').trim();
    
    if (matches.length === 0 || !text) continue;
    
    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = parseInt(match[3].padEnd(3, '0'), 10);
      
      lines.push({
        time: minutes * 60 + seconds + ms / 1000,
        text,
      });
    }
  }
  
  // Sort by time
  lines.sort((a, b) => a.time - b.time);
  
  // Calculate durations
  for (let i = 0; i < lines.length - 1; i++) {
    lines[i].duration = lines[i + 1].time - lines[i].time;
  }
  
  return lines;
}

// Helper to convert to LRC format
export function toLRC(lines: LyricLine[]): string {
  return lines.map(line => {
    const mins = Math.floor(line.time / 60);
    const secs = Math.floor(line.time % 60);
    const ms = Math.round((line.time % 1) * 100);
    
    const timestamp = `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
    return `${timestamp}${line.text}`;
  }).join('\n');
}
