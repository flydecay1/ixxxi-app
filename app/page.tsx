"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePlayer } from "../context/PlayerContext"; 
import { useToast } from "../context/ToastContext";
import Header from "../components/Header";
import GlobeView from "../components/GlobeView";
import { GateCheckOverlay, GateBadge } from "../components/GateCheckOverlay";
import CommandPalette from "../components/CommandPalette";
import { CompactTerminal } from "../components/BloombergTerminal";
import LiveClock from "../components/LiveClock";
import { useWallet } from "@solana/wallet-adapter-react";
import { MapPin, Activity, Lock, Unlock, Command, Wifi, WifiOff, Tv, Upload, Radio, TrendingUp, Users, Zap, ChevronRight, Play, Pause } from "lucide-react";
import Link from "next/link";

import type { AudioAsset } from "./types";

// Utility to parse coordinates string like "35.6762° N, 139.6503° E"
function parseCoordinates(coordStr: string | undefined): { lat: number, lon: number } | null {
  if (!coordStr) return null;
  const match = coordStr.match(/([\d.]+)[°]?\s*([NS]),?\s*([\d.]+)[°]?\s*([EW])/i);
  if (!match) return null;
  let lat = parseFloat(match[1]);
  let lon = parseFloat(match[3]);
  if (match[2].toUpperCase() === 'S') lat = -lat;
  if (match[4].toUpperCase() === 'W') lon = -lon;
  return { lat, lon };
}

// Format lat/lon for display
function formatLatLon(coordStr: string | undefined): { latDisplay: string, lonDisplay: string } {
  const parsed = parseCoordinates(coordStr);
  if (!parsed) return { latDisplay: '--.----', lonDisplay: '--.----' };
  return {
    latDisplay: `${Math.abs(parsed.lat).toFixed(4)} ${parsed.lat >= 0 ? 'N' : 'S'}`,
    lonDisplay: `${Math.abs(parsed.lon).toFixed(4)} ${parsed.lon >= 0 ? 'E' : 'W'}`,
  };
}

// Demo token mint address for testing (replace with real token on mainnet)
const DEMO_TOKEN_MINT = "So11111111111111111111111111111111111111112"; // Wrapped SOL for testing

const MARKET_ASSETS: AudioAsset[] = [
  {
    id: "1",
    ticker: "LOFI-BTC",
    title: "Midnight Tokyo",
    artist: "Neural Net",
    coverUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=1",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    currentPrice: 3420.50,
    change24h: 2.5,
    volume: "1.2M",
    region: "TOKYO, JP",
    coordinates: "35.6762° N, 139.6503° E",
    isPremium: false,
    gateType: 'none',
  },
  {
    id: "2",
    ticker: "ETH-WAVE",
    title: "Synthwave",
    artist: "Mainframe",
    coverUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=2",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    currentPrice: 1840.20,
    change24h: -1.2,
    volume: "850K",
    region: "BERLIN, DE",
    coordinates: "52.5200° N, 13.4050° E",
    isPremium: true,
    gateType: 'token',
    requiredTokenMint: DEMO_TOKEN_MINT,
    requiredTokenAmount: 0.01, // Require 0.01 SOL worth for testing
  },
  {
    id: "3",
    ticker: "SOL-DRIP",
    title: "Acid Rain",
    artist: "DePin DJ",
    coverUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=3",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    currentPrice: 89.15,
    change24h: 0,
    volume: "3.4M",
    region: "MIAMI, US",
    coordinates: "25.7617° N, 80.1918° W",
    isPremium: false,
    gateType: 'none',
  },
  {
    id: "4",
    ticker: "NFT-BASS",
    title: "Deep Protocol",
    artist: "Chain Smoker",
    coverUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=4",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    currentPrice: 420.69,
    change24h: 8.8,
    volume: "2.1M",
    region: "NYC, US",
    coordinates: "40.7128° N, 74.0060° W",
    isPremium: true,
    gateType: 'nft',
    collectionAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // Example collection
  }
];

export default function Home() {
  const { playTrack, currentTrack, isPlaying, audioIntensity, frequencyData, gateStatus } = usePlayer();
  const { connected, publicKey } = useWallet();
  const toast = useToast();
  const [showGateOverlay, setShowGateOverlay] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<AudioAsset | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const { latDisplay, lonDisplay } = formatLatLon(currentTrack?.coordinates);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection Restored", "Back online");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Connection Lost", "Check your network");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Global keyboard shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAssetClick = async (asset: AudioAsset) => {
    // If premium and not connected, prompt wallet connection
    if (asset.isPremium && !connected) {
      toast.warning("Wallet Required", "Connect your wallet to access premium tracks");
      return;
    }

    // If premium, show gate overlay and check access
    if (asset.isPremium && connected) {
      setSelectedTrack(asset);
      setShowGateOverlay(true);
    }

    // Play the track (gate check happens in PlayerContext)
    await playTrack(asset);
    
    // Hide overlay after successful play
    if (!asset.isPremium) {
      setShowGateOverlay(false);
    }
  };

  const handleGateOverlayClose = () => {
    setShowGateOverlay(false);
    setSelectedTrack(null);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      <Header />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        tracks={MARKET_ASSETS}
        onSelectTrack={handleAssetClick}
        currentTrack={currentTrack}
      />

      {/* Gate Check Overlay */}
      <GateCheckOverlay 
        gateStatus={gateStatus}
        isVisible={showGateOverlay && selectedTrack?.isPremium === true}
        onClose={handleGateOverlayClose}
        requiredAmount={selectedTrack?.requiredTokenAmount}
        tokenSymbol={selectedTrack?.gateType === 'nft' ? 'NFT' : 'TOKEN'}
      />

      <div className="flex flex-col md:flex-row flex-1 pt-16 pb-20 overflow-hidden">

        {/* LEFT COLUMN: ACTION PANEL */}
        <div className="md:w-[420px] w-full md:h-full h-[50vh] border-r border-white/5 flex flex-col glass-dark z-20 overflow-hidden backdrop-blur-2xl">

          {/* Header with Clock */}
          <div className="p-4 border-b border-white/10 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 animate-pulse"></div>
                  <span className="font-semibold text-sm gradient-text tracking-wide">IXXXI PROTOCOL</span>
                </div>
                {isOnline ? (
                  <Wifi size={14} className="text-cyan-400" />
                ) : (
                  <WifiOff size={14} className="text-red-400" />
                )}
              </div>
              <LiveClock className="text-xs text-gray-400 font-mono" showDate={false} />
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/artist/apply"
                className="group relative overflow-hidden glass rounded-xl p-3.5 hover:bg-white/10 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <Upload size={16} className="text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm text-purple-400 font-medium">Upload</span>
                </div>
              </Link>
              <Link
                href="/tv"
                className="group relative overflow-hidden glass rounded-xl p-3.5 hover:bg-white/10 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <Radio size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm text-cyan-400 font-medium">Live TV</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-px p-3 border-b border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent">
            <div className="text-center p-3 glass rounded-lg">
              <div className="text-xl font-bold gradient-text">12.4K</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Listeners</div>
            </div>
            <div className="text-center p-3 glass rounded-lg">
              <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent">$2.4M</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">24h Vol</div>
            </div>
            <div className="text-center p-3 glass rounded-lg">
              <div className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">847</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Artists</div>
            </div>
          </div>

          {/* Trending Section Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-white/[0.02] to-transparent border-b border-white/5">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-cyan-400" />
              <span className="font-semibold text-sm text-white">Trending Now</span>
            </div>
            <Link href="/charts" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors group">
              View All
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Track List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {MARKET_ASSETS.map((asset, index) => {
              const changeColor = asset.change24h > 0 ? 'cyan-400' : asset.change24h < 0 ? 'red-400' : 'gray-400';
              const changeSign = asset.change24h > 0 ? '+' : '';
              const isActive = currentTrack?.id === asset.id;

              return (
                <div
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className={`group relative p-4 border-b border-white/5 cursor-pointer flex items-center justify-between transition-all duration-300 ${isActive ? 'bg-gradient-to-r from-cyan-500/10 via-purple-500/5 to-transparent border-l-2 border-l-cyan-400' : 'hover:bg-white/5'} ${asset.isPremium && !connected ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Rank */}
                    <span className="text-base font-bold bg-gradient-to-br from-gray-400 to-gray-600 bg-clip-text text-transparent w-6">{index + 1}</span>

                    {/* Cover */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-cyan-400/50 transition-all duration-300">
                      <img src={asset.coverUrl} alt={`${asset.title} cover`} className="w-full h-full object-cover" />
                      {/* Play overlay on hover */}
                      <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-sm transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isActive && isPlaying ? (
                          <Pause size={18} className="text-cyan-400 drop-shadow-lg" />
                        ) : (
                          <Play size={18} className="text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
                        )}
                      </div>
                      {/* Gate Badge */}
                      {asset.isPremium && (
                        <div className={`absolute top-1 right-1 p-1 rounded backdrop-blur-md ${connected ? 'bg-cyan-500/80' : 'bg-red-500/80'}`}>
                          {connected ? <Unlock size={10} className="text-white" /> : <Lock size={10} className="text-white" />}
                        </div>
                      )}
                      {/* Active indicator */}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500"></div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{asset.title}</span>
                        {asset.isPremium && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${asset.gateType === 'nft' ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30' : 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'}`}>
                            {asset.gateType === 'nft' ? 'NFT' : 'TOKEN'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">{asset.artist} • {asset.region}</div>
                    </div>
                  </div>

                  {/* Price/Change */}
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-white">${asset.currentPrice.toFixed(2)}</div>
                    <div className={`text-[11px] font-mono font-medium text-${changeColor}`}>{changeSign}{asset.change24h.toFixed(2)}%</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom: Live Feed */}
          <div className="border-t border-green-500/20 p-2">
            <CompactTerminal />
          </div>
        </div>

        {/* RIGHT COLUMN: 3D GLOBE ENGINE */}
        <div className="flex-1 relative md:h-full h-[50vh]">
          <GlobeView 
            activeTrack={currentTrack} 
            audioIntensity={audioIntensity}
            bassLevel={frequencyData.bassLevel}
            midLevel={frequencyData.midLevel}
            highLevel={frequencyData.highLevel}
          />
          
          {/* Now Playing Overlay */}
          <div className="absolute bottom-10 left-10 p-6 glass-strong rounded-2xl max-w-sm backdrop-blur-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              {isPlaying ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 animate-pulse"></div>
                    <span className="text-[10px] gradient-text tracking-widest uppercase font-semibold">NOW PLAYING</span>
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-gray-500 tracking-widest uppercase font-semibold">SELECT A TRACK</span>
              )}
            </div>
            <div className="text-3xl font-bold text-white mb-1">{currentTrack?.title || "Orbital_Idle"}</div>
            <div className="text-sm text-gray-400 mb-2">{currentTrack?.artist ? `by ${currentTrack.artist}` : ''}</div>
            <div className="text-xs text-gray-500 mb-4">{currentTrack?.region || ''}</div>
            <div className="flex gap-6 text-[11px] text-gray-400 font-mono">
              <div className="flex items-center gap-1.5">
                <MapPin size={12} className="text-cyan-400" />
                <span>LAT: {latDisplay}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={12} className="text-purple-400" />
                <span>LON: {lonDisplay}</span>
              </div>
            </div>
          </div>

          {/* Command Palette Hint */}
          <div className="absolute top-20 right-6">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 px-4 py-2.5 glass rounded-xl hover:bg-white/10 transition-all duration-300 text-xs font-medium group border border-white/10 hover:border-cyan-400/50"
            >
              <Command size={14} className="text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-gray-400 group-hover:text-white transition-colors">⌘K</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}