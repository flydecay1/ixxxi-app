// context/PlayerContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { checkGate } from "@/lib/solana/tokenGate";
import type { AudioAsset, GateStatus } from "../app/types";

export interface FrequencyData {
  intensity: number;
  bassLevel: number;
  midLevel: number;
  highLevel: number;
}

interface PlayerState {
  currentTrack: AudioAsset | null;
  isPlaying: boolean;
  audioIntensity: number;
  frequencyData: FrequencyData;
  gateStatus: GateStatus;
  playTrack: (track: AudioAsset) => Promise<void>;
  togglePlay: () => void;
  setAudioIntensity: (intensity: number) => void;
  setFrequencyData: (data: FrequencyData) => void;
  registerAudioElement: (element: HTMLAudioElement | null) => void;
  audioElement: HTMLAudioElement | null;
  checkTrackAccess: (track: AudioAsset) => Promise<boolean>;
  recordPlay: (completed?: boolean) => void;
  currentPlayId: string | null;
  playDuration: number;
}

export const PlayerContext = createContext<PlayerState | undefined>(undefined);

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
  const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
  const [playDuration, setPlayDuration] = useState(0);
  const playStartTime = useRef<number>(0);

  const { connection } = useConnection();
  const { publicKey } = useWallet();

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

  const playTrack = useCallback(async (track: AudioAsset) => {
    // Toggle if clicking the same track
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    // Check gate access for premium tracks
    if (track.isPremium) {
      const hasAccess = await checkTrackAccess(track);
      if (!hasAccess) {
        console.log('Access denied: Token gate requirement not met');
        return;
      }
    }

    // Reset play tracking for new track
    setCurrentPlayId(null);
    playStartTime.current = Date.now();
    
    setCurrentTrack(track);
    setIsPlaying(true);
  }, [currentTrack, checkTrackAccess]);

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
      playTrack, 
      togglePlay,
      setAudioIntensity,
      setFrequencyData,
      registerAudioElement,
      audioElement,
      checkTrackAccess,
      recordPlay,
      currentPlayId,
      playDuration,
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