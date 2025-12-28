// app/data/mockData.ts
export const MOCK_LIBRARY: Track[] = [
  {
    id: 1,
    artist: 'NATE_001',
    title: 'GENESIS_PROTOCOL.wav',
    album: 'IXXXI ZERO',
    year: '2025',
    duration: '3:45',
    price: 0.05,
    currentPrice: 0.07,
    volume24h: 1200,
    bondingCurvePosition: 'Phase 2 - Ascending',
    audioUrl: 'https://freemusicarchive.org/music/Tours/enthusiast/Tours_-_01_-_Enthusiast.mp3', // Public domain from FMA
    ownerAddress: '2b5LwmACB7k6fa8uM6Uo7He8yng1WjkQ2EGQvYWU9TQV',
    location: { lat: 30.2672, lng: -97.7431, label: 'AUSTIN_NODE_A1' },
  },
  {
    id: 2,
    artist: 'NULL_POINTER',
    title: 'DEPIN_DRIFT.flac',
    album: 'WIRE_FRAME',
    year: '2024',
    duration: '2:20',
    price: 0.1,
    currentPrice: 0.12,
    volume24h: 850,
    bondingCurvePosition: 'Phase 1 - Stable',
    audioUrl: 'https://freemusicarchive.org/music/Kevin_MacLeod/Jazz_Sampler/Impact_Prelude.mp3', // Public domain from FMA
    ownerAddress: '2b5LwmACB7k6fa8uM6Uo7He8yng1WjkQ2EGQvYWU9TQV',
    location: { lat: 35.6762, lng: 139.6503, label: 'TOKYO_NODE_C4' },
  },
  // Add more tracks as needed with similar structure
];

export interface Track {
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
}