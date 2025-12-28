// types/index.ts

export type GateType = 'token' | 'nft' | 'none';

export interface AudioAsset {
  id: string;
  ticker: string;       // e.g., "Nirvana" -> "NRV"
  title: string;
  artist: string;
  coverUrl: string;     // URL for the album art (small thumbnail)
  audioUrl: string;     // The mp3/wav source
  currentPrice: number; // Aesthetic metric (e.g. play count equivalent)
  change24h: number;    // Percentage change (green/red indicator)
  volume: string;       // e.g., "1.2M"
  region: string;       // e.g., "TOKYO, JP"
  coordinates: string;  // e.g., "35.6° N"
  // Token gating fields
  gateType?: GateType;
  requiredTokenMint?: string;
  requiredTokenAmount?: number;
  collectionAddress?: string;
  isPremium?: boolean;
}

export interface GateStatus {
  checking: boolean;
  hasAccess: boolean;
  error?: string;
  balance?: number;
}

export interface PlayerState {
  currentTrack: AudioAsset | null;
  isPlaying: boolean;
  playTrack: (track: AudioAsset) => void;
  togglePlay: () => void;
}