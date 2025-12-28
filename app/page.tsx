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
    <div className="flex flex-col h-screen bg-black text-green-500 font-mono overflow-hidden">
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
        <div className="md:w-[380px] w-full md:h-full h-[50vh] border-r border-green-500/20 flex flex-col bg-black/95 z-20 overflow-hidden">
          
          {/* Header with Clock */}
          <div className="p-3 border-b border-green-500/20 bg-green-900/10">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="font-bold">IXXXI PROTOCOL</span>
                {isOnline ? (
                  <Wifi size={10} className="text-green-500" />
                ) : (
                  <WifiOff size={10} className="text-red-500" />
                )}
                <span className={`${isOnline ? 'animate-pulse text-green-400' : 'text-red-500'}`}>
                  ● {isOnline ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
              <LiveClock className="text-xs" showDate={false} />
            </div>
            
            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Link 
                href="/artist/apply"
                className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 rounded-lg hover:border-purple-400 transition-all group"
              >
                <Upload size={16} className="text-purple-400" />
                <span className="text-sm text-purple-400 font-medium">Upload</span>
              </Link>
              <Link 
                href="/tv"
                className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-cyan-500/20 to-green-500/20 border border-cyan-500/30 rounded-lg hover:border-cyan-400 transition-all group"
              >
                <Radio size={16} className="text-cyan-400" />
                <span className="text-sm text-cyan-400 font-medium">Live TV</span>
              </Link>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-1 p-2 border-b border-green-500/20 bg-black/50">
            <div className="text-center p-2">
              <div className="text-lg font-bold text-green-400">12.4K</div>
              <div className="text-[8px] text-gray-500 uppercase">Listeners</div>
            </div>
            <div className="text-center p-2 border-x border-green-500/10">
              <div className="text-lg font-bold text-cyan-400">$2.4M</div>
              <div className="text-[8px] text-gray-500 uppercase">24h Vol</div>
            </div>
            <div className="text-center p-2">
              <div className="text-lg font-bold text-purple-400">847</div>
              <div className="text-[8px] text-gray-500 uppercase">Artists</div>
            </div>
          </div>

          {/* Trending Section Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-green-900/10">
            <div className="flex items-center gap-2 text-[10px]">
              <TrendingUp size={12} className="text-green-400" />
              <span className="font-bold">TRENDING NOW</span>
            </div>
            <Link href="/charts" className="text-[10px] text-green-400 hover:underline flex items-center">
              View All <ChevronRight size={12} />
            </Link>
          </div>

          {/* Track List */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {MARKET_ASSETS.map((asset, index) => {
              const changeColor = asset.change24h > 0 ? 'green-500' : asset.change24h < 0 ? 'red-500' : 'gray-500';
              const changeSign = asset.change24h > 0 ? '+' : '';
              const isActive = currentTrack?.id === asset.id;
              
              return (
                <div 
                  key={asset.id} 
                  onClick={() => handleAssetClick(asset)}
                  className={`group p-3 border-b border-white/5 cursor-pointer flex items-center justify-between hover:bg-green-500/5 transition-all ${isActive ? 'bg-green-500/10 border-l-2 border-l-green-500' : ''} ${asset.isPremium && !connected ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <span className="text-lg font-bold text-gray-600 w-6">{index + 1}</span>
                    
                    {/* Cover */}
                    <div className="relative w-10 h-10 bg-gray-900 border border-white/10 rounded overflow-hidden">
                      <img src={asset.coverUrl} alt={`${asset.title} cover`} className="w-full h-full object-cover" />
                      {/* Play overlay on hover */}
                      <div className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isActive && isPlaying ? (
                          <Pause size={16} className="text-green-400" />
                        ) : (
                          <Play size={16} className="text-white" />
                        )}
                      </div>
                      {/* Gate Badge */}
                      {asset.isPremium && (
                        <div className={`absolute top-0 right-0 p-0.5 ${connected ? 'bg-green-500' : 'bg-red-500'}`}>
                          {connected ? <Unlock size={8} /> : <Lock size={8} />}
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{asset.title}</span>
                        {asset.isPremium && (
                          <span className={`text-[8px] px-1 py-0.5 rounded ${asset.gateType === 'nft' ? 'bg-purple-900/50 text-purple-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                            {asset.gateType === 'nft' ? 'NFT' : 'TOKEN'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500">{asset.artist} • {asset.region}</div>
                    </div>
                  </div>
                  
                  {/* Price/Change */}
                  <div className="text-right">
                    <div className="text-sm font-mono text-white">${asset.currentPrice.toFixed(2)}</div>
                    <div className={`text-[10px] font-mono text-${changeColor}`}>{changeSign}{asset.change24h.toFixed(2)}%</div>
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
          <div className="absolute bottom-10 left-10 p-4 border border-green-500/20 bg-black/70 backdrop-blur-md max-w-xs rounded-lg">
            <div className="text-[10px] text-green-500/50 mb-1 tracking-widest uppercase flex items-center gap-1">
              {isPlaying ? (
                <>
                  <Activity size={10} className="animate-pulse text-green-400" />
                  NOW PLAYING
                </>
              ) : (
                'SELECT A TRACK'
              )}
            </div>
            <div className="text-2xl font-bold text-white">{currentTrack?.title || "Orbital_Idle"}</div>
            <div className="text-sm text-gray-400">{currentTrack?.artist ? `by ${currentTrack.artist}` : ''}</div>
            <div className="text-xs text-gray-500 mt-1">{currentTrack?.region || ''}</div>
            <div className="flex gap-4 mt-3 text-[10px] text-green-600">
              <div className="flex items-center gap-1">
                <MapPin size={10} />
                LAT: {latDisplay}
              </div>
              <div className="flex items-center gap-1">
                <MapPin size={10} />
                LON: {lonDisplay}
              </div>
            </div>
          </div>

          {/* Command Palette Hint */}
          <div className="absolute top-20 right-4">
            <button 
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 px-3 py-2 bg-black/50 border border-green-500/30 rounded-lg hover:bg-green-500/10 transition-colors text-xs"
            >
              <Command size={12} />
              <span>⌘K</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}