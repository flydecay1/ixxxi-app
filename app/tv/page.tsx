// app/tv/page.tsx
// IXXXI TV - Cinematic music visualization station

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Radio, Tv2, Wifi, Clock, TrendingUp, Zap, X, Settings, Maximize2, Upload, ListMusic } from 'lucide-react';

// Dynamically import the globe to avoid SSR issues
const GlobeBackground = dynamic(() => import('@/components/GlobeBackground'), { 
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />
});

interface Channel {
  id: string;
  name: string;
  description: string;
  genre: string;
  currentTrack: {
    title: string;
    artist: string;
    coverUrl: string;
    duration: number; // in seconds
  };
  viewerCount: number;
  isLive: boolean;
  location: {
    name: string;
    coordinates: [number, number];
  };
  visualizerType: 'waveform' | 'bars' | 'circles' | 'particles';
  color: string;
}

// TV Channels with unique audio visualizers
const TV_CHANNELS: Channel[] = [
  {
    id: 'ch1',
    name: 'IXXXI PRIME',
    description: 'Top charting tracks worldwide',
    genre: 'Electronic',
    currentTrack: { title: 'Neon Pulse', artist: 'Digital Dreams', coverUrl: 'https://placehold.co/400x400/1a1a2e/00ff88?text=🎵', duration: 240 },
    viewerCount: 12453,
    isLive: true,
    location: { name: 'Los Angeles, USA', coordinates: [34.0522, -118.2437] },
    visualizerType: 'bars',
    color: '#00ff88'
  },
  {
    id: 'ch2',
    name: 'TOKYO NIGHTS',
    description: 'Future bass & kawaii beats',
    genre: 'Future Bass',
    currentTrack: { title: 'Sakura Dreams', artist: 'Neon Tokyo', coverUrl: 'https://placehold.co/400x400/2d1b69/ff66b2?text=🌸', duration: 198 },
    viewerCount: 8721,
    isLive: true,
    location: { name: 'Tokyo, Japan', coordinates: [35.6762, 139.6503] },
    visualizerType: 'circles',
    color: '#ff66b2'
  },
  {
    id: 'ch3',
    name: 'BERLIN TECHNO',
    description: 'Underground warehouse vibes',
    genre: 'Techno',
    currentTrack: { title: 'Warehouse 303', artist: 'Dark Factory', coverUrl: 'https://placehold.co/400x400/0d0d0d/ffcc00?text=⚡', duration: 420 },
    viewerCount: 15302,
    isLive: true,
    location: { name: 'Berlin, Germany', coordinates: [52.5200, 13.4050] },
    visualizerType: 'waveform',
    color: '#ffcc00'
  },
  {
    id: 'ch4',
    name: 'LATIN HEAT',
    description: 'Reggaeton & electronic fusion',
    genre: 'Latin Electronic',
    currentTrack: { title: 'Fuego Digital', artist: 'Sol y Luna', coverUrl: 'https://placehold.co/400x400/4a1a4a/ff4444?text=🔥', duration: 215 },
    viewerCount: 9847,
    isLive: true,
    location: { name: 'São Paulo, Brazil', coordinates: [-23.5505, -46.6333] },
    visualizerType: 'particles',
    color: '#ff4444'
  },
  {
    id: 'ch5',
    name: 'UK GARAGE',
    description: '2-step & garage classics',
    genre: 'Garage',
    currentTrack: { title: 'South London Vibes', artist: 'Garage Revival', coverUrl: 'https://placehold.co/400x400/1a2a3a/00ccff?text=🇬🇧', duration: 195 },
    viewerCount: 6234,
    isLive: true,
    location: { name: 'London, UK', coordinates: [51.5074, -0.1278] },
    visualizerType: 'bars',
    color: '#00ccff'
  },
  {
    id: 'ch6',
    name: 'LO-FI STUDY',
    description: 'Chill beats to relax/study to',
    genre: 'Lo-Fi',
    currentTrack: { title: 'Rainy Day Coffee', artist: 'Cozy Beats', coverUrl: 'https://placehold.co/400x400/2a1f2d/bb86fc?text=☕', duration: 180 },
    viewerCount: 22104,
    isLive: true,
    location: { name: 'Seoul, Korea', coordinates: [37.5665, 126.9780] },
    visualizerType: 'circles',
    color: '#bb86fc'
  },
];

// Audio Visualizer Component
function AudioVisualizer({ type, color, isPlaying }: { type: string; color: string; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);
    
    let frame = 0;
    
    const draw = () => {
      if (!isPlaying) {
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        animationRef.current = requestAnimationFrame(draw);
        return;
      }
      
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      frame++;
      
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      
      if (type === 'bars') {
        const barCount = 64;
        const barWidth = w / barCount - 2;
        for (let i = 0; i < barCount; i++) {
          const height = (Math.sin(frame * 0.05 + i * 0.3) * 0.5 + 0.5) * h * 0.8;
          const gradient = ctx.createLinearGradient(0, h, 0, h - height);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, color + '20');
          ctx.fillStyle = gradient;
          ctx.fillRect(i * (barWidth + 2), h - height, barWidth, height);
        }
      } else if (type === 'waveform') {
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        for (let i = 0; i < w; i++) {
          const y = h / 2 + Math.sin(frame * 0.03 + i * 0.02) * (h * 0.3) * Math.sin(i * 0.01);
          ctx.lineTo(i, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Mirror line
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        for (let i = 0; i < w; i++) {
          const y = h / 2 - Math.sin(frame * 0.03 + i * 0.02) * (h * 0.3) * Math.sin(i * 0.01);
          ctx.lineTo(i, y);
        }
        ctx.strokeStyle = color + '60';
        ctx.stroke();
      } else if (type === 'circles') {
        const centerX = w / 2;
        const centerY = h / 2;
        for (let i = 0; i < 8; i++) {
          const radius = (i + 1) * 30 + Math.sin(frame * 0.05 + i) * 20;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = color + Math.floor((1 - i / 8) * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else if (type === 'particles') {
        for (let i = 0; i < 50; i++) {
          const x = (Math.sin(frame * 0.02 + i * 0.5) + 1) / 2 * w;
          const y = (Math.cos(frame * 0.03 + i * 0.7) + 1) / 2 * h;
          const size = Math.sin(frame * 0.1 + i) * 3 + 4;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = color + '80';
          ctx.fill();
        }
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [type, color, isPlaying]);
  
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

export default function TVPage() {
  const [channels] = useState<Channel[]>(TV_CHANNELS);
  const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [showChannelList, setShowChannelList] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const hideUITimeout = useRef<NodeJS.Timeout>();
  const currentChannel = channels[currentChannelIndex];

  // Time display
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate track progress
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress(prev => (prev + 1) % 100);
    }, currentChannel.currentTrack.duration * 10);
    return () => clearInterval(interval);
  }, [isPlaying, currentChannel]);

  // Auto-hide UI after inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowUI(true);
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
      hideUITimeout.current = setTimeout(() => {
        if (isPlaying && !showChannelList) setShowUI(false);
      }, 4000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    };
  }, [isPlaying, showChannelList]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setCurrentChannelIndex(prev => (prev - 1 + channels.length) % channels.length);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setCurrentChannelIndex(prev => (prev + 1) % channels.length);
          break;
        case 'm':
          setIsMuted(prev => !prev);
          break;
        case 'g':
          setShowChannelList(prev => !prev);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'Escape':
          if (showChannelList) {
            setShowChannelList(false);
          } else if (isFullscreen) {
            document.exitFullscreen();
          } else {
            window.history.back();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels.length, showChannelList, isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Globe Background */}
      <div className="absolute inset-0 opacity-40">
        <GlobeBackground 
          targetLocation={currentChannel.location.coordinates}
          isTransitioning={false}
        />
      </div>

      {/* Audio Visualizer */}
      <div className="absolute inset-0">
        <AudioVisualizer 
          type={currentChannel.visualizerType} 
          color={currentChannel.color}
          isPlaying={isPlaying}
        />
      </div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30 pointer-events-none" />
      
      {/* Scanlines Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.1)_2px,rgba(255,255,255,0.1)_4px)]" />

      {/* Center Album Art */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          key={currentChannel.id}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.9 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <div className={`w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden shadow-2xl ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s', boxShadow: `0 0 60px ${currentChannel.color}40` }}>
            <img 
              src={currentChannel.currentTrack.coverUrl} 
              alt={currentChannel.currentTrack.title}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Center hole */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-black rounded-full border-2" style={{ borderColor: currentChannel.color + '60' }} />
          </div>
        </motion.div>
      </div>

      {/* UI Overlay */}
      <AnimatePresence>
        {showUI && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-b from-black/90 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Tv2 size={20} className="text-white" />
                    <span className="text-white font-bold tracking-wider">IXXXI TV</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: currentChannel.color + '30' }}>
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentChannel.color }} />
                    <span className="text-white/90 text-sm font-mono">{currentChannel.name}</span>
                  </div>
                  <span className="text-white/50 text-xs hidden md:block">{currentChannel.viewerCount.toLocaleString()} watching</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/60 text-sm font-mono">{currentTime}</span>
                  <Link 
                    href="/"
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 text-sm transition flex items-center gap-2"
                  >
                    <X size={16} />
                    <span className="hidden md:inline">Exit</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-black via-black/80 to-transparent">
              {/* Progress Bar */}
              <div className="w-full h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, backgroundColor: currentChannel.color }} />
              </div>
              
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1 max-w-2xl">
                  {/* Location & Genre */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: currentChannel.color }} />
                      <span className="text-sm font-mono" style={{ color: currentChannel.color }}>📍 {currentChannel.location.name}</span>
                    </div>
                    <span className="text-white/40 text-xs px-2 py-0.5 bg-white/10 rounded-full">{currentChannel.genre}</span>
                  </div>

                  {/* Track Info */}
                  <motion.div key={`track-${currentChannel.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-1">{currentChannel.currentTrack.title}</h1>
                    <p className="text-lg md:text-xl text-white/70">{currentChannel.currentTrack.artist}</p>
                  </motion.div>

                  {/* Controls */}
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => setCurrentChannelIndex(prev => (prev - 1 + channels.length) % channels.length)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
                    >
                      <SkipBack size={20} className="text-white" />
                    </button>
                    
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-3 rounded-full transition" style={{ backgroundColor: currentChannel.color }}
                    >
                      {isPlaying ? <Pause size={24} className="text-black" /> : <Play size={24} className="text-black" />}
                    </button>
                    
                    <button
                      onClick={() => setCurrentChannelIndex(prev => (prev + 1) % channels.length)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
                    >
                      <SkipForward size={20} className="text-white" />
                    </button>
                    
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition ml-2"
                    >
                      {isMuted ? <VolumeX size={20} className="text-white/50" /> : <Volume2 size={20} className="text-white" />}
                    </button>
                    
                    <button
                      onClick={() => setShowChannelList(true)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
                    >
                      <ListMusic size={20} className="text-white" />
                    </button>
                    
                    <button onClick={toggleFullscreen} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition">
                      <Maximize2 size={20} className="text-white" />
                    </button>
                  </div>

                  {/* Keyboard Hints */}
                  <div className="flex items-center gap-3 mt-3 text-white/30 text-xs">
                    <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Space</kbd> Play</span>
                    <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑↓</kbd> Channels</span>
                    <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">G</kbd> Guide</span>
                    <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">F</kbd> Fullscreen</span>
                  </div>
                </div>

                {/* Channel Number Display */}
                <div className="text-right hidden md:block">
                  <div className="text-6xl font-bold text-white/20 font-mono">CH{(currentChannelIndex + 1).toString().padStart(2, '0')}</div>
                  <div className="text-white/40 text-sm">{currentChannelIndex + 1} of {channels.length}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel List Overlay */}
      <AnimatePresence>
        {showChannelList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center"
          >
            <div className="w-full max-w-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Radio size={24} />
                  Channel Guide
                </h2>
                <button
                  onClick={() => setShowChannelList(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
              
              <div className="grid gap-3">
                {channels.map((channel, index) => (
                  <motion.button
                    key={channel.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => { setCurrentChannelIndex(index); setShowChannelList(false); }}
                    className={`w-full p-4 rounded-xl flex items-center gap-4 transition ${index === currentChannelIndex ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}
                    style={{ 
                      boxShadow: index === currentChannelIndex ? `0 0 0 2px ${channel.color}` : 'none'
                    }}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={channel.currentTrack.coverUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">{channel.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: channel.color + '30', color: channel.color }}>{channel.genre}</span>
                        {channel.isLive && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-white/60">Now: {channel.currentTrack.title} - {channel.currentTrack.artist}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-mono text-white/30">{(index + 1).toString().padStart(2, '0')}</div>
                      <div className="text-xs text-white/40">{channel.viewerCount.toLocaleString()}</div>
                    </div>
                  </motion.button>
                ))}
              </div>
              
              {/* Upload CTA */}
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold">Want your music on IXXXI TV?</h3>
                    <p className="text-white/60 text-sm">Apply as an artist and get featured globally</p>
                  </div>
                  <Link href="/artist/apply" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white flex items-center gap-2 transition">
                    <Upload size={16} />
                    Apply
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
