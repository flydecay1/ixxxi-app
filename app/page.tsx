"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePlayer } from "../context/PlayerContext"; 
import { useToast } from "../context/ToastContext";
import Header from "../components/Header";
import GlobeView from "../components/GlobeView";
import { GateCheckOverlay, GateBadge } from "../components/GateCheckOverlay";
import CommandPalette from "../components/CommandPalette";
import { useWallet } from "@solana/wallet-adapter-react";
import { MapPin, Activity, Lock, Unlock, Command, Wifi, WifiOff, Tv } from "lucide-react";
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
        
        {/* LEFT COLUMN: COMPACT FEED */}
        <div className="md:w-[350px] w-full md:h-full h-[50vh] border-r md:border-r border-green-500/20 flex flex-col bg-black/90 z-20 overflow-hidden">
          <div className="p-3 border-b border-green-500/20 bg-green-900/10 text-[10px] tracking-tighter flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>TERMINAL_v.5</span>
              {isOnline ? (
                <Wifi size={10} className="text-green-500" />
              ) : (
                <WifiOff size={10} className="text-red-500" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/tv"
                className="flex items-center gap-1 px-2 py-1 border border-cyan-500/30 rounded hover:bg-cyan-500/10 transition-colors text-cyan-400"
                title="TV Mode"
              >
                <Tv size={10} />
                <span className="hidden sm:inline">TV</span>
              </Link>
              <button 
                onClick={() => setShowCommandPalette(true)}
                className="flex items-center gap-1 px-2 py-1 border border-green-500/30 rounded hover:bg-green-500/10 transition-colors"
                title="Search (⌘K)"
              >
                <Command size={10} />
                <span className="hidden sm:inline">⌘K</span>
              </button>
              <span className={`${isOnline ? 'animate-pulse' : 'text-red-500'}`}>
                ● {isOnline ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {MARKET_ASSETS.map((asset) => {
              const changeColor = asset.change24h > 0 ? 'green-500' : asset.change24h < 0 ? 'red-500' : 'gray-500';
              const changeSign = asset.change24h > 0 ? '+' : '';
              return (
                <div 
                  key={asset.id} 
                  onClick={() => handleAssetClick(asset)}
                  className={`group p-2 border-b border-white/5 cursor-pointer flex items-center justify-between hover:bg-green-500/5 transition-all ${currentTrack?.id === asset.id ? 'bg-green-500/10 border-l-2 border-l-green-500' : ''} ${asset.isPremium && !connected ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 relative">
                    <div className="relative w-8 h-8 bg-gray-900 border border-white/10 overflow-hidden">
                      <img src={asset.coverUrl} alt={`${asset.title} cover`} className="w-full h-full object-cover" />
                      {/* Gate Badge */}
                      {asset.isPremium && (
                        <div className={`absolute inset-0 flex items-center justify-center ${connected ? 'bg-green-500/20' : 'bg-red-500/30'}`}>
                          {connected ? (
                            <Unlock size={10} className="text-green-400" />
                          ) : (
                            <Lock size={10} className="text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold leading-none">{asset.ticker}</span>
                        {asset.isPremium && (
                          <span className={`text-[8px] px-1 ${asset.gateType === 'nft' ? 'bg-purple-900/50 text-purple-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                            {asset.gateType === 'nft' ? 'NFT' : 'TOKEN'}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500">{asset.region}</div>
                    </div>
                  </div>
                  <div className="text-right text-[10px]">
                    <div className="text-gray-400">${asset.currentPrice.toFixed(2)}</div>
                    <div className={`text-${changeColor}`}>{changeSign}{asset.change24h.toFixed(2)}%</div>
                  </div>
                </div>
              );
            })}
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
          
          {/* Overlay UI */}
          <div className="absolute bottom-10 left-10 p-4 border border-green-500/20 bg-black/60 backdrop-blur-md max-w-xs">
            <div className="text-[10px] text-green-500/50 mb-1 tracking-widest uppercase flex items-center gap-1">
              Targeting_System {isPlaying && <Activity size={10} className="animate-pulse" />}
            </div>
            <div className="text-2xl font-bold uppercase">{currentTrack?.title || "Orbital_Idle"}</div>
            <div className="text-sm text-green-500/80">{currentTrack?.artist ? `by ${currentTrack.artist}` : ''}</div>
            <div className="text-xs text-green-500/60 mt-1">{currentTrack?.region || ''}</div>
            <div className="flex gap-4 mt-2 text-[10px] text-green-700">
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
        </div>
      </div>
    </div>
  );
}