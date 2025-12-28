"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import { WorldClock } from "@/components/LiveClock";
import BloombergTerminal from "@/components/BloombergTerminal";
import { 
  TrendingUp, Play, Clock, Users, Globe, 
  ChevronRight, Headphones, Star, Zap 
} from "lucide-react";
import Link from "next/link";

// Mock data for discover page
const GENRES = [
  { id: "electronic", name: "Electronic", count: 1234, color: "#22c55e" },
  { id: "hiphop", name: "Hip Hop", count: 892, color: "#f97316" },
  { id: "lofi", name: "Lo-Fi", count: 756, color: "#06b6d4" },
  { id: "ambient", name: "Ambient", count: 543, color: "#8b5cf6" },
  { id: "house", name: "House", count: 421, color: "#ec4899" },
  { id: "dnb", name: "Drum & Bass", count: 389, color: "#eab308" },
];

const FEATURED_PLAYLISTS = [
  { id: "1", name: "Crypto Chill", tracks: 45, streams: "1.2M", cover: "https://api.dicebear.com/7.x/shapes/svg?seed=playlist1" },
  { id: "2", name: "DeFi Beats", tracks: 32, streams: "890K", cover: "https://api.dicebear.com/7.x/shapes/svg?seed=playlist2" },
  { id: "3", name: "NFT Anthems", tracks: 28, streams: "750K", cover: "https://api.dicebear.com/7.x/shapes/svg?seed=playlist3" },
  { id: "4", name: "Web3 Waves", tracks: 56, streams: "2.1M", cover: "https://api.dicebear.com/7.x/shapes/svg?seed=playlist4" },
];

const RISING_ARTISTS = [
  { id: "1", name: "Neural Net", followers: "45.2K", growth: 234, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=artist1" },
  { id: "2", name: "Chain Smoker", followers: "32.1K", growth: 189, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=artist2" },
  { id: "3", name: "DePin DJ", followers: "28.9K", growth: 156, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=artist3" },
  { id: "4", name: "Mainframe", followers: "21.4K", growth: 142, avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=artist4" },
];

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6 pb-32">
        {/* World Clock */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Discover</h1>
          <WorldClock />
        </div>

        {/* Featured Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Featured Playlists
            </h2>
            <Link href="#" className="text-sm text-green-400 hover:underline flex items-center gap-1">
              See all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURED_PLAYLISTS.map((playlist) => (
              <div
                key={playlist.id}
                className="group relative bg-gray-900/50 rounded-lg p-4 border border-gray-800 hover:border-green-500/50 transition-all cursor-pointer"
              >
                <div className="aspect-square rounded-lg overflow-hidden mb-3 relative">
                  <img src={playlist.cover} alt={playlist.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-12 h-12 text-white" />
                  </div>
                </div>
                <h3 className="font-bold text-white truncate">{playlist.name}</h3>
                <p className="text-sm text-gray-400">{playlist.tracks} tracks • {playlist.streams} streams</p>
              </div>
            ))}
          </div>
        </section>

        {/* Genres Grid */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Browse by Genre
            </h2>
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {GENRES.map((genre) => (
              <div
                key={genre.id}
                className="relative bg-gray-900/50 rounded-lg p-4 border border-gray-800 hover:border-opacity-50 transition-all cursor-pointer overflow-hidden group"
                style={{ borderColor: genre.color }}
              >
                <div 
                  className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                  style={{ backgroundColor: genre.color }}
                />
                <h3 className="font-bold text-white relative z-10">{genre.name}</h3>
                <p className="text-sm text-gray-400 relative z-10">{genre.count.toLocaleString()} tracks</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rising Artists */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Rising Artists
            </h2>
            <Link href="#" className="text-sm text-green-400 hover:underline flex items-center gap-1">
              See all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {RISING_ARTISTS.map((artist, i) => (
              <div
                key={artist.id}
                className="bg-gray-900/50 rounded-lg p-4 border border-gray-800 hover:border-green-500/50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-bold text-green-400 font-mono">#{i + 1}</span>
                  <img src={artist.avatar} alt={artist.name} className="w-12 h-12 rounded-full" />
                </div>
                <h3 className="font-bold text-white">{artist.name}</h3>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-gray-400">{artist.followers} followers</span>
                  <span className="text-green-400">+{artist.growth}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live Activity */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Live Network Activity
            </h2>
          </div>
          <BloombergTerminal />
        </section>
      </main>
    </div>
  );
}
