// app/context/PlayerContext.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Track {
  id: number;
  artist: string;
  title: string;
  album: string;
  year: string;
  duration: string;
  price: number;
  currentPrice: number;
  volume24h: number;
  bondingCurvePosition: string;
  audioUrl: string;
  ownerAddress: string;
  location: { lat: number; lng: number; label: string };
  bpm?: number;
  key?: string;
  status?: string;
  listeners?: number;
  value?: string;
  trend?: string;
  change?: string;
}

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  setCurrentTrack: (track: Track) => void;
  togglePlay: () => void;
  setVolume: (vol: number) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);

  const togglePlay = () => setIsPlaying((prev) => !prev);

  return (
    <PlayerContext.Provider
      value={{ currentTrack, isPlaying, volume, setCurrentTrack, togglePlay, setVolume }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (undefined === context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};