// context/PlayerContext.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
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

  const { connection } = useConnection();
  const { publicKey } = useWallet();

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