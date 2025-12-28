// components/player/ProtectedAudioPlayer.tsx
// DRM-protected audio player - prevents downloading/ripping

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface ProtectedAudioPlayerProps {
  trackId: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  autoPlay?: boolean;
}

export default function ProtectedAudioPlayer({
  trackId,
  onTimeUpdate,
  onEnded,
  onError,
  autoPlay = false,
}: ProtectedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastReportedTime = useRef(0);
  
  // Fetch protected stream URL
  const fetchStreamUrl = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/stream?trackId=${trackId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load stream');
      }
      
      const data = await res.json();
      setStreamUrl(data.streamUrl);
      setIsLoading(false);
      
      // Store watermark for reporting
      if (data.watermark) {
        sessionStorage.setItem(`watermark_${trackId}`, data.watermark);
      }
      
      return data;
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Stream error');
      setIsLoading(false);
      return null;
    }
  }, [trackId, onError]);
  
  // Initialize player with protection measures
  useEffect(() => {
    // Fetch initial stream URL
    fetchStreamUrl();
    
    // Refresh stream URL periodically (every 25 seconds, before 30s expiry)
    refreshIntervalRef.current = setInterval(fetchStreamUrl, 25000);
    
    // Cleanup
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchStreamUrl]);
  
  // Set up audio element with protections
  useEffect(() => {
    if (!streamUrl || !audioRef.current) return;
    
    const audio = audioRef.current;
    
    // Prevent direct access to audio element
    Object.defineProperty(audio, 'src', {
      get: () => '',
      set: () => {},
    });
    
    // Create audio context for processing (watermark injection would happen here)
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    // Set source through our controlled method
    audio.setAttribute('data-src', streamUrl);
    
    // Use Media Source Extensions for more control in production
    // For now, direct src assignment (would be encrypted HLS in prod)
    const originalSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (originalSrc?.set) {
      originalSrc.set.call(audio, streamUrl);
    }
    
    // Auto-play if specified
    if (autoPlay) {
      audio.play().catch(() => {});
    }
  }, [streamUrl, autoPlay]);
  
  // Report playback duration for anti-rip detection
  const reportPlayback = useCallback(async (duration: number) => {
    const watermark = sessionStorage.getItem(`watermark_${trackId}`);
    if (!watermark) return;
    
    try {
      await fetch(`/api/content/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          watermark,
          duration,
          timestamp: Date.now(),
        }),
      });
    } catch {
      // Silent fail for reporting
    }
  }, [trackId]);
  
  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    onTimeUpdate?.(audio.currentTime, audio.duration);
    
    // Report every 30 seconds of playback
    const currentTime = Math.floor(audio.currentTime);
    if (currentTime > 0 && currentTime % 30 === 0 && currentTime !== lastReportedTime.current) {
      lastReportedTime.current = currentTime;
      reportPlayback(currentTime);
    }
  }, [onTimeUpdate, reportPlayback]);
  
  // Handle ended
  const handleEnded = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      reportPlayback(audio.duration);
    }
    onEnded?.();
  }, [onEnded, reportPlayback]);
  
  // Prevent right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  }, []);
  
  // Block keyboard shortcuts for developer tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        return false;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Detect developer tools (basic detection)
  useEffect(() => {
    const detectDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if (widthThreshold || heightThreshold) {
        // Dev tools might be open - could pause playback or warn
        console.log('[DRM] Developer tools detected');
      }
    };
    
    window.addEventListener('resize', detectDevTools);
    return () => window.removeEventListener('resize', detectDevTools);
  }, []);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-12">
        <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <audio
      ref={audioRef}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      onContextMenu={handleContextMenu}
      controlsList="nodownload noplaybackrate"
      crossOrigin="anonymous"
      preload="metadata"
      className="hidden"
    />
  );
}
