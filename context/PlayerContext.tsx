// context/PlayerContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { checkGate } from "@/lib/solana/tokenGate";
import type { AudioAsset, GateStatus } from "../app/types";

export interface FrequencyData {
  intensity: number;
  bassLevel: number;
  midLevel: number;
  highLevel: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

interface QueueItem {
  track: AudioAsset;
  queueId: string;
}

interface PlayerState {
  // Current playback
  currentTrack: AudioAsset | null;
  isPlaying: boolean;
  audioIntensity: number;
  frequencyData: FrequencyData;
  gateStatus: GateStatus;
  
  // Queue management
  queue: QueueItem[];
  queueIndex: number;
  originalQueue: QueueItem[];
  history: QueueItem[];
  
  // Playback modes
  shuffle: boolean;
  repeat: RepeatMode;
  crossfade: number;
  
  // Audio element
  audioElement: HTMLAudioElement | null;
  
  // Play tracking
  currentPlayId: string | null;
  playDuration: number;
  
  // Actions
  playTrack: (track: AudioAsset) => Promise<void>;
  playTracks: (tracks: AudioAsset[], startIndex?: number) => Promise<void>;
  togglePlay: () => void;
  
  // Queue actions
  addToQueue: (track: AudioAsset) => void;
  addNext: (track: AudioAsset) => void;
  removeFromQueue: (queueId: string) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  skipTo: (queueId: string) => void;
  
  // Navigation
  next: () => void;
  previous: () => void;
  
  // Mode toggles
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setCrossfade: (seconds: number) => void;
  
  // Utilities
  setAudioIntensity: (intensity: number) => void;
  setFrequencyData: (data: FrequencyData) => void;
  registerAudioElement: (element: HTMLAudioElement | null) => void;
  checkTrackAccess: (track: AudioAsset) => Promise<boolean>;
  recordPlay: (completed?: boolean) => void;
}

export const PlayerContext = createContext<PlayerState | undefined>(undefined);

const generateQueueId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [currentTrack, setCurrentTrack] = useState<AudioAsset | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [frequencyData, setFrequencyData] = useState<FrequencyData>({
    intensity: 0,
    bassLevel: 0,
    midLevel: 0,
    highLevel: 0,
  });
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [gateStatus, setGateStatus] = useState<GateStatus>({
    checking: false,
    hasAccess: true,
  });
  
  // Queue state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [originalQueue, setOriginalQueue] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<QueueItem[]>([]);
  
  // Playback modes
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [crossfade, setCrossfadeTime] = useState(0);
  const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
  const [playDuration, setPlayDuration] = useState(0);
  const playStartTime = useRef<number>(0);

  const { connection } = useConnection();
  const { publicKey } = useWallet();

  // Load saved preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedShuffle = localStorage.getItem('player_shuffle');
    const savedRepeat = localStorage.getItem('player_repeat');
    const savedCrossfade = localStorage.getItem('player_crossfade');
    
    if (savedShuffle) setShuffle(savedShuffle === 'true');
    if (savedRepeat) setRepeat(savedRepeat as RepeatMode);
    if (savedCrossfade) setCrossfadeTime(parseInt(savedCrossfade, 10));
  }, []);

  // Save preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('player_shuffle', String(shuffle));
    localStorage.setItem('player_repeat', repeat);
    localStorage.setItem('player_crossfade', String(crossfade));
  }, [shuffle, repeat, crossfade]);

  // Record a play to the API
  const recordPlay = useCallback(async (completed = false) => {
    if (!currentTrack) return;
    
    const duration = Math.round((Date.now() - playStartTime.current) / 1000);
    setPlayDuration(duration);
    
    try {
      // If we have a playId, update it; otherwise create new
      if (currentPlayId) {
        await fetch(`/api/tracks/${currentTrack.id}/play`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playId: currentPlayId,
            duration,
            completed,
          }),
        });
      } else {
        const res = await fetch(`/api/tracks/${currentTrack.id}/play`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: publicKey?.toBase58(),
            duration,
            completed,
            source: 'player',
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setCurrentPlayId(data.playId);
        }
      }
    } catch (error) {
      console.error('Failed to record play:', error);
    }
  }, [currentTrack, currentPlayId, publicKey]);

  const checkTrackAccess = useCallback(async (track: AudioAsset): Promise<boolean> => {
    // No gate required
    if (!track.gateType || track.gateType === 'none') {
      return true;
    }

    // Check if it's a premium track requiring gate
    if (!track.isPremium) {
      return true;
    }

    setGateStatus({ checking: true, hasAccess: false });

    try {
      const result = await checkGate(
        publicKey?.toBase58() || null,
        {
          gateType: track.gateType,
          requiredTokenMint: track.requiredTokenMint,
          requiredTokenAmount: track.requiredTokenAmount,
          collectionAddress: track.collectionAddress,
        },
        connection
      );

      setGateStatus({
        checking: false,
        hasAccess: result.hasAccess,
        error: result.error,
        balance: result.balance,
      });

      return result.hasAccess;
    } catch (error) {
      setGateStatus({
        checking: false,
        hasAccess: false,
        error: error instanceof Error ? error.message : 'Gate check failed',
      });
      return false;
    }
  }, [publicKey, connection]);

  // Internal: Play a specific queue item
  const playQueueItem = useCallback(async (item: QueueItem, index: number) => {
    const { track } = item;
    
    if (track.isPremium) {
      const hasAccess = await checkTrackAccess(track);
      if (!hasAccess) {
        console.log('Access denied: Token gate requirement not met');
        return false;
      }
    }

    // Add current track to history
    if (currentTrack && queueIndex >= 0 && queue[queueIndex]) {
      setHistory(prev => [...prev.slice(-49), queue[queueIndex]]);
    }

    setCurrentPlayId(null);
    playStartTime.current = Date.now();
    setCurrentTrack(track);
    setQueueIndex(index);
    setIsPlaying(true);
    
    return true;
  }, [currentTrack, queueIndex, queue, checkTrackAccess]);

  // Play single track
  const playTrack = useCallback(async (track: AudioAsset) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(prev => !prev);
      return;
    }

    const item: QueueItem = { track, queueId: generateQueueId() };
    setQueue([item]);
    setOriginalQueue([item]);
    await playQueueItem(item, 0);
  }, [currentTrack, playQueueItem]);

  // Play multiple tracks
  const playTracks = useCallback(async (tracks: AudioAsset[], startIndex = 0) => {
    if (tracks.length === 0) return;

    const items: QueueItem[] = tracks.map(track => ({
      track,
      queueId: generateQueueId(),
    }));

    setOriginalQueue(items);
    
    if (shuffle) {
      const startItem = items[startIndex];
      const otherItems = [...items.slice(0, startIndex), ...items.slice(startIndex + 1)];
      const shuffledOthers = shuffleArray(otherItems);
      setQueue([startItem, ...shuffledOthers]);
      await playQueueItem(startItem, 0);
    } else {
      setQueue(items);
      await playQueueItem(items[startIndex], startIndex);
    }
  }, [shuffle, playQueueItem]);

  // Add to end of queue
  const addToQueue = useCallback((track: AudioAsset) => {
    const item: QueueItem = { track, queueId: generateQueueId() };
    setQueue(prev => [...prev, item]);
    setOriginalQueue(prev => [...prev, item]);
  }, []);

  // Add to play next
  const addNext = useCallback((track: AudioAsset) => {
    const item: QueueItem = { track, queueId: generateQueueId() };
    setQueue(prev => [
      ...prev.slice(0, queueIndex + 1),
      item,
      ...prev.slice(queueIndex + 1),
    ]);
  }, [queueIndex]);

  // Remove from queue
  const removeFromQueue = useCallback((queueId: string) => {
    setQueue(prev => prev.filter(item => item.queueId !== queueId));
  }, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    setQueue([]);
    setOriginalQueue([]);
    setQueueIndex(-1);
  }, []);

  // Reorder queue
  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const newQueue = [...prev];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      return newQueue;
    });
  }, []);

  // Skip to track in queue
  const skipTo = useCallback(async (queueId: string) => {
    const index = queue.findIndex(item => item.queueId === queueId);
    if (index >= 0) {
      await playQueueItem(queue[index], index);
    }
  }, [queue, playQueueItem]);

  // Next track
  const next = useCallback(async () => {
    if (queue.length === 0) return;
    if (currentTrack) recordPlay(true);

    let nextIndex = queueIndex + 1;

    if (repeat === 'one') {
      nextIndex = queueIndex;
    } else if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    await playQueueItem(queue[nextIndex], nextIndex);
  }, [queue, queueIndex, repeat, currentTrack, recordPlay, playQueueItem]);

  // Previous track
  const previous = useCallback(async () => {
    if (queue.length === 0) return;

    if (audioElement && audioElement.currentTime > 3) {
      audioElement.currentTime = 0;
      return;
    }

    let prevIndex = queueIndex - 1;
    
    if (prevIndex < 0) {
      if (repeat === 'all') {
        prevIndex = queue.length - 1;
      } else {
        if (audioElement) audioElement.currentTime = 0;
        return;
      }
    }

    await playQueueItem(queue[prevIndex], prevIndex);
  }, [queue, queueIndex, repeat, audioElement, playQueueItem]);

  // Toggle shuffle
  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const newShuffle = !prev;
      
      if (newShuffle && queue.length > 0) {
        const upcomingItems = queue.slice(queueIndex + 1);
        const shuffledUpcoming = shuffleArray(upcomingItems);
        setQueue([...queue.slice(0, queueIndex + 1), ...shuffledUpcoming]);
      } else if (!newShuffle && originalQueue.length > 0) {
        const currentItem = queue[queueIndex];
        const originalIndex = originalQueue.findIndex(item => item.queueId === currentItem?.queueId);
        setQueue(originalQueue);
        if (originalIndex >= 0) setQueueIndex(originalIndex);
      }
      
      return newShuffle;
    });
  }, [queue, queueIndex, originalQueue]);

  // Toggle repeat
  const toggleRepeat = useCallback(() => {
    setRepeat(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  // Set crossfade
  const setCrossfade = useCallback((seconds: number) => {
    setCrossfadeTime(Math.max(0, Math.min(12, seconds)));
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const registerAudioElement = useCallback((element: HTMLAudioElement | null) => {
    setAudioElement(element);
  }, []);

  return (
    <PlayerContext.Provider value={{ 
      currentTrack, 
      isPlaying, 
      audioIntensity,
      frequencyData,
      gateStatus,
      
      queue,
      queueIndex,
      originalQueue,
      history,
      
      shuffle,
      repeat,
      crossfade,
      
      audioElement,
      currentPlayId,
      playDuration,
      
      playTrack,
      playTracks,
      togglePlay,
      
      addToQueue,
      addNext,
      removeFromQueue,
      clearQueue,
      reorderQueue,
      skipTo,
      
      next,
      previous,
      
      toggleShuffle,
      toggleRepeat,
      setCrossfade,
      
      setAudioIntensity,
      setFrequencyData,
      registerAudioElement,
      checkTrackAccess,
      recordPlay,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
};