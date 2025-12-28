// components/BottomPlayer.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { usePlayer } from "@/context/PlayerContext";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { Play, Pause, SkipForward, SkipBack, Zap, Volume2, VolumeX, Volume1 } from "lucide-react";

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function BottomPlayer() {
  const { currentTrack, isPlaying, togglePlay, setAudioIntensity, setFrequencyData, registerAudioElement, audioElement } = usePlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  
  // Audio analyzer hook - use the registered audio element from context
  const { intensity, bassLevel, midLevel, highLevel } = useAudioAnalyzer(audioElement);

  // Register audio element with context
  useEffect(() => {
    registerAudioElement(audioRef.current);
  }, [registerAudioElement]);

  // Set initial volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, []);

  // Update global audio data for globe visualization
  useEffect(() => {
    setAudioIntensity(intensity);
    setFrequencyData({ intensity, bassLevel, midLevel, highLevel });
  }, [intensity, bassLevel, midLevel, highLevel, setAudioIntensity, setFrequencyData]);

  // Playback Logic
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(e => console.log("Audio play error:", e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  // Progress Bar Logic
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration || 1;
      setCurrentTime(current);
      setProgress((current / total) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const seekTime = (Number(e.target.value) / 100) * audioRef.current.duration;
      audioRef.current.currentTime = seekTime;
      setProgress(Number(e.target.value));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value) / 100;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (currentTrack) togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => {
            const newVol = Math.min(1, v + 0.1);
            if (audioRef.current) audioRef.current.volume = newVol;
            return newVol;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => {
            const newVol = Math.max(0, v - 0.1);
            if (audioRef.current) audioRef.current.volume = newVol;
            return newVol;
          });
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTrack, togglePlay, duration]);

  // Volume icon based on level
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // 1. EMPTY STATE (No track selected)
  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 w-full h-12 bg-black border-t border-green-900/50 flex items-center justify-between px-4 z-50">
        <span className="text-xs text-green-900 font-mono animate-pulse">Waiting for signal...</span>
        <div className="text-[10px] text-green-900/50 hidden sm:block">
          Press ⌘K to search • Space to play/pause • ←→ to seek
        </div>
        <div className="flex gap-2">
            <div className="w-2 h-2 bg-green-900 rounded-full animate-ping delay-75"></div>
            <div className="w-2 h-2 bg-green-900 rounded-full animate-ping delay-150"></div>
            <div className="w-2 h-2 bg-green-900 rounded-full animate-ping delay-300"></div>
        </div>
      </div>
    );
  }

  // 2. ACTIVE STATE (The Trading Desk)
  return (
    <div className="fixed bottom-0 left-0 w-full z-50">
      <audio
        ref={audioRef}
        src={currentTrack.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => togglePlay()}
      />

      {/* Glassmorphism Container */}
      <div className="h-20 bg-black/80 backdrop-blur-md border-t border-green-500/50 flex items-center justify-between px-6 relative">
        
        {/* Progress Line (Top Border) - clickable */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 bg-green-900/30 cursor-pointer group"
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={() => setIsHoveringProgress(false)}
        >
          <div 
            className={`h-full bg-green-400 shadow-[0_0_15px_#4ade80] transition-all ${isHoveringProgress ? 'h-2' : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* LEFT: ASSET INFO */}
        <div className="flex items-center gap-4 w-1/3">
          <div className="relative h-12 w-12 border border-green-500/30 bg-green-900/10 flex items-center justify-center overflow-hidden">
             <img src={currentTrack.coverUrl} className="opacity-80 object-cover w-full h-full" alt="cover" />
             {/* Scanline overlay */}
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          </div>
          <div className="font-mono flex flex-col justify-center">
            <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-green-400 tracking-widest">{currentTrack.ticker}</span>
                <span className={`text-[10px] px-1 rounded ${currentTrack.change24h > 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {currentTrack.change24h > 0 ? '+' : ''}{currentTrack.change24h}%
                </span>
            </div>
            <span className="text-xs text-gray-400 truncate max-w-[200px]">{currentTrack.title}</span>
          </div>
        </div>

        {/* CENTER: CONTROLS */}
        <div className="flex flex-col items-center justify-center w-1/3 gap-1">
          <div className="flex items-center gap-6">
            <button 
              className="text-gray-500 hover:text-green-400 transition-colors"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
                }
              }}
              title="Back 10s (←)"
            >
              <SkipBack size={18} />
            </button>
            
            <button 
                onClick={togglePlay}
                className="w-12 h-12 border border-green-500 flex items-center justify-center hover:bg-green-500 hover:text-black transition-all shadow-[0_0_10px_rgba(34,197,94,0.4)] rounded-sm"
                title="Play/Pause (Space)"
            >
                {isPlaying ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor" className="ml-1" />}
            </button>

            <button 
              className="text-gray-500 hover:text-green-400 transition-colors"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
                }
              }}
              title="Forward 10s (→)"
            >
              <SkipForward size={18} />
            </button>
          </div>
          
          {/* Time Display */}
          <div className="flex items-center gap-2 text-[10px] text-green-600 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* RIGHT: VOLUME + METRICS */}
        <div className="w-1/3 flex justify-end items-center gap-4 font-mono text-xs">
            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleMute}
                className="text-gray-500 hover:text-green-400 transition-colors"
                title="Mute (M)"
              >
                <VolumeIcon size={16} />
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume * 100}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                title="Volume (↑↓)"
              />
            </div>
            
            <div className="hidden md:block text-right">
                <div className="text-gray-500">24H VOL</div>
                <div className="text-green-300">{currentTrack.volume}</div>
            </div>
            <div className="text-right">
                <div className="text-gray-500">PRICE</div>
                <div className="text-green-400 font-bold text-sm">${currentTrack.currentPrice}</div>
            </div>
            <Zap size={16} className="text-yellow-500 animate-pulse hidden sm:block" />
        </div>

      </div>
    </div>
  );
}