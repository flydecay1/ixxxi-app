// app/tv/page.tsx
// IXXXI TV - Cinematic music video station with globe visualization

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

// Dynamically import the globe to avoid SSR issues
const GlobeBackground = dynamic(() => import('@/components/GlobeBackground'), { 
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />
});

interface Track {
  id: string;
  title: string;
  artist: string;
  videoUrl: string; // YouTube embed URL for now
  coverUrl: string;
  location: {
    name: string;
    coordinates: [number, number]; // [lat, lng]
  };
  year?: number;
  genre?: string;
}

// Placeholder tracks - will be replaced with real data
const PLACEHOLDER_TRACKS: Track[] = [
  {
    id: '1',
    title: 'Neon Dreams',
    artist: 'Synthwave Artist',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    coverUrl: '/placeholder-cover.jpg',
    location: { name: 'Los Angeles, USA', coordinates: [34.0522, -118.2437] },
    year: 2024,
    genre: 'Synthwave'
  },
  {
    id: '2',
    title: 'Tokyo Midnight',
    artist: 'Future Bass Producer',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    coverUrl: '/placeholder-cover.jpg',
    location: { name: 'Tokyo, Japan', coordinates: [35.6762, 139.6503] },
    year: 2024,
    genre: 'Future Bass'
  },
  {
    id: '3',
    title: 'Berlin Underground',
    artist: 'Techno Collective',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    coverUrl: '/placeholder-cover.jpg',
    location: { name: 'Berlin, Germany', coordinates: [52.5200, 13.4050] },
    year: 2024,
    genre: 'Techno'
  },
  {
    id: '4',
    title: 'São Paulo Heat',
    artist: 'Latin Electronic',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    coverUrl: '/placeholder-cover.jpg',
    location: { name: 'São Paulo, Brazil', coordinates: [-23.5505, -46.6333] },
    year: 2024,
    genre: 'Latin Electronic'
  },
  {
    id: '5',
    title: 'London Calling',
    artist: 'UK Garage Revival',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder
    coverUrl: '/placeholder-cover.jpg',
    location: { name: 'London, UK', coordinates: [51.5074, -0.1278] },
    year: 2024,
    genre: 'UK Garage'
  },
];

export default function TVPage() {
  const [tracks] = useState<Track[]>(PLACEHOLDER_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const hideUITimeout = useRef<NodeJS.Timeout>();
  const currentTrack = tracks[shuffledIndices[currentIndex] ?? 0];

  // Shuffle tracks on mount
  useEffect(() => {
    const indices = [...Array(tracks.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledIndices(indices);
  }, [tracks.length]);

  // Auto-hide UI after inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowUI(true);
      if (hideUITimeout.current) {
        clearTimeout(hideUITimeout.current);
      }
      hideUITimeout.current = setTimeout(() => {
        if (isPlaying) setShowUI(false);
      }, 4000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    };
  }, [isPlaying]);

  // Handle track change
  const changeTrack = useCallback((direction: 'next' | 'prev') => {
    setIsTransitioning(true);
    setTimeout(() => {
      if (direction === 'next') {
        setCurrentIndex((prev) => (prev + 1) % shuffledIndices.length);
      } else {
        setCurrentIndex((prev) => (prev - 1 + shuffledIndices.length) % shuffledIndices.length);
      }
      setIsTransitioning(false);
    }, 1000);
  }, [shuffledIndices.length]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case 'ArrowRight':
          changeTrack('next');
          break;
        case 'ArrowLeft':
          changeTrack('prev');
          break;
        case 'Escape':
          window.history.back();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeTrack]);

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden cursor-none">
      {/* Globe Background */}
      <div className="absolute inset-0 opacity-60">
        <GlobeBackground 
          targetLocation={currentTrack.location.coordinates}
          isTransitioning={isTransitioning}
        />
      </div>

      {/* Video Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTrack.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: isTransitioning ? 0 : 0.85 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="relative w-full h-full max-w-[177.78vh] max-h-[56.25vw]">
            <iframe
              src={`${currentTrack.videoUrl}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&modestbranding=1&loop=1`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {/* Vignette overlay */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_70%,rgba(0,0,0,0.7)_100%)]" />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Scanlines Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.3)_2px,rgba(0,0,0,0.3)_4px)]" />

      {/* UI Overlay */}
      <AnimatePresence>
        {showUI && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white/80 text-sm font-mono tracking-wider">IXXXI TV</span>
                  </div>
                  <span className="text-white/40 text-xs">LIVE</span>
                </div>
                <button 
                  onClick={() => window.history.back()}
                  className="pointer-events-auto px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white/80 text-sm transition"
                >
                  Exit TV Mode
                </button>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
              <div className="max-w-4xl">
                {/* Location Badge */}
                <motion.div
                  key={`loc-${currentTrack.id}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-2 mb-4"
                >
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                  <span className="text-cyan-400 text-sm font-mono tracking-wide">
                    📍 {currentTrack.location.name}
                  </span>
                  {currentTrack.genre && (
                    <span className="text-white/40 text-xs px-2 py-0.5 bg-white/10 rounded-full ml-2">
                      {currentTrack.genre}
                    </span>
                  )}
                </motion.div>

                {/* Track Info */}
                <motion.div
                  key={`info-${currentTrack.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h1 className="text-5xl md:text-7xl font-bold text-white mb-2 tracking-tight">
                    {currentTrack.title}
                  </h1>
                  <p className="text-2xl text-white/70">
                    {currentTrack.artist}
                    {currentTrack.year && (
                      <span className="text-white/40 ml-3">({currentTrack.year})</span>
                    )}
                  </p>
                </motion.div>

                {/* Controls */}
                <div className="flex items-center gap-4 mt-8 pointer-events-auto">
                  <button
                    onClick={() => changeTrack('prev')}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition"
                    disabled={isTransitioning}
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-4 bg-white/20 hover:bg-white/30 rounded-full transition"
                  >
                    {isPlaying ? (
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  
                  <button
                    onClick={() => changeTrack('next')}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition"
                    disabled={isTransitioning}
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="ml-4 text-white/40 text-sm">
                    {currentIndex + 1} / {shuffledIndices.length}
                  </div>
                </div>

                {/* Keyboard hints */}
                <div className="flex items-center gap-4 mt-4 text-white/30 text-xs">
                  <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Space</kbd> Play/Pause</span>
                  <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">←</kbd> <kbd className="px-1.5 py-0.5 bg-white/10 rounded">→</kbd> Navigate</span>
                  <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Esc</kbd> Exit</span>
                </div>
              </div>
            </div>

            {/* Up Next Preview */}
            {shuffledIndices.length > 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="absolute bottom-32 right-8 pointer-events-auto"
              >
                <p className="text-white/40 text-xs mb-2 font-mono">UP NEXT</p>
                <div className="flex items-center gap-3 p-3 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded flex items-center justify-center">
                    🎵
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {tracks[shuffledIndices[(currentIndex + 1) % shuffledIndices.length]]?.title}
                    </p>
                    <p className="text-white/50 text-xs">
                      {tracks[shuffledIndices[(currentIndex + 1) % shuffledIndices.length]]?.artist}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transition Overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60 text-sm font-mono">Loading next track...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
