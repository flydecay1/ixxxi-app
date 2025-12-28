"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import { WorldClock } from "@/components/LiveClock";
import { 
  TrendingUp, TrendingDown, Play, Pause, 
  ChevronUp, ChevronDown, Clock, BarChart3, 
  ArrowUpRight, ArrowDownRight, Volume2
} from "lucide-react";

// Mock chart data
const CHART_DATA = [
  { rank: 1, prev: 2, ticker: "LOFI-BTC", title: "Midnight Tokyo", artist: "Neural Net", price: 3420.50, change: 15.4, volume: "1.2M", streams: "2.4M" },
  { rank: 2, prev: 1, ticker: "SOL-DRIP", title: "Acid Rain", artist: "DePin DJ", price: 89.15, change: -2.3, volume: "3.4M", streams: "1.8M" },
  { rank: 3, prev: 5, ticker: "ETH-WAVE", title: "Synthwave Dreams", artist: "Mainframe", price: 1840.20, change: 8.7, volume: "850K", streams: "1.5M" },
  { rank: 4, prev: 3, ticker: "NFT-BASS", title: "Deep Protocol", artist: "Chain Smoker", price: 420.69, change: -5.1, volume: "2.1M", streams: "1.2M" },
  { rank: 5, prev: 8, ticker: "DEFI-BEAT", title: "Liquidity Pool", artist: "Yield Farm", price: 156.00, change: 22.4, volume: "980K", streams: "980K" },
  { rank: 6, prev: 4, ticker: "DAO-DROP", title: "Governance", artist: "Vote Count", price: 78.50, change: -8.9, volume: "540K", streams: "750K" },
  { rank: 7, prev: 9, ticker: "STAKE-SONG", title: "Validator Vibes", artist: "Epoch Lord", price: 234.10, change: 12.1, volume: "420K", streams: "620K" },
  { rank: 8, prev: 6, ticker: "MINT-MIX", title: "Fresh Press", artist: "Supply Chain", price: 45.30, change: -3.2, volume: "890K", streams: "580K" },
  { rank: 9, prev: 10, ticker: "GAS-GROOVE", title: "Low Fee Feels", artist: "L2 Larry", price: 12.80, change: 5.6, volume: "1.1M", streams: "540K" },
  { rank: 10, prev: 7, ticker: "BRIDGE-BASS", title: "Cross Chain", artist: "Interop", price: 67.90, change: -1.8, volume: "320K", streams: "420K" },
];

type SortKey = "rank" | "change" | "volume" | "streams" | "price";

export default function ChartsPage() {
  const [sortBy, setSortBy] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "30d" | "all">("24h");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const sortedData = [...CHART_DATA].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    if (sortBy === "volume" || sortBy === "streams") {
      // Parse volume strings like "1.2M"
      const parseVal = (v: string) => {
        const num = parseFloat(v);
        if (v.includes("M")) return num * 1000000;
        if (v.includes("K")) return num * 1000;
        return num;
      };
      aVal = parseVal(aVal as string);
      bVal = parseVal(bVal as string);
    }
    
    if (sortAsc) return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(key === "rank");
    }
  };

  const getRankChange = (current: number, prev: number) => {
    const diff = prev - current;
    if (diff > 0) return { icon: ChevronUp, color: "text-green-400", text: `+${diff}` };
    if (diff < 0) return { icon: ChevronDown, color: "text-red-400", text: `${diff}` };
    return { icon: null, color: "text-gray-500", text: "—" };
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-6 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-green-400" />
              Top Charts
            </h1>
            <p className="text-gray-400 mt-1">Most traded tracks on the IXXXI network</p>
          </div>
          <WorldClock />
        </div>

        {/* Timeframe Tabs */}
        <div className="flex gap-2 mb-6">
          {(["24h", "7d", "30d", "all"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
                timeframe === tf 
                  ? "bg-green-500/20 text-green-400 border border-green-500/50" 
                  : "bg-gray-900/50 text-gray-400 border border-gray-800 hover:bg-gray-800"
              }`}
            >
              {tf === "all" ? "ALL TIME" : tf.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase">Total Volume</div>
            <div className="text-2xl font-bold text-white font-mono">$12.4M</div>
            <div className="text-xs text-green-400">+8.5% vs yesterday</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase">Total Trades</div>
            <div className="text-2xl font-bold text-white font-mono">45,892</div>
            <div className="text-xs text-green-400">+12.3% vs yesterday</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase">Avg Trade Size</div>
            <div className="text-2xl font-bold text-white font-mono">$270</div>
            <div className="text-xs text-red-400">-3.1% vs yesterday</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase">Active Traders</div>
            <div className="text-2xl font-bold text-white font-mono">8,421</div>
            <div className="text-xs text-green-400">+5.7% vs yesterday</div>
          </div>
        </div>

        {/* Chart Table */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-900/80 border-b border-gray-800 text-xs uppercase text-gray-500 font-mono">
            <button 
              onClick={() => handleSort("rank")}
              className="col-span-1 flex items-center gap-1 hover:text-white"
            >
              # {sortBy === "rank" && (sortAsc ? "↑" : "↓")}
            </button>
            <div className="col-span-4">Track</div>
            <button 
              onClick={() => handleSort("price")}
              className="col-span-2 flex items-center gap-1 hover:text-white text-right justify-end"
            >
              Price {sortBy === "price" && (sortAsc ? "↑" : "↓")}
            </button>
            <button 
              onClick={() => handleSort("change")}
              className="col-span-2 flex items-center gap-1 hover:text-white text-right justify-end"
            >
              Change {sortBy === "change" && (sortAsc ? "↑" : "↓")}
            </button>
            <button 
              onClick={() => handleSort("volume")}
              className="col-span-2 flex items-center gap-1 hover:text-white text-right justify-end"
            >
              Volume {sortBy === "volume" && (sortAsc ? "↑" : "↓")}
            </button>
            <div className="col-span-1"></div>
          </div>

          {/* Table Body */}
          {sortedData.map((track, i) => {
            const rankChange = getRankChange(track.rank, track.prev);
            const RankIcon = rankChange.icon;
            const isPlaying = playingId === track.ticker;

            return (
              <div 
                key={track.ticker}
                className={`grid grid-cols-12 gap-4 px-4 py-4 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                  i < 3 ? "bg-green-500/5" : ""
                }`}
              >
                {/* Rank */}
                <div className="col-span-1 flex items-center gap-2">
                  <span className={`text-lg font-bold font-mono ${i < 3 ? "text-green-400" : "text-white"}`}>
                    {track.rank}
                  </span>
                  <div className={`flex items-center text-xs ${rankChange.color}`}>
                    {RankIcon && <RankIcon className="w-3 h-3" />}
                  </div>
                </div>

                {/* Track Info */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center">
                    <span className="text-xs font-bold">{track.ticker.split("-")[0]}</span>
                  </div>
                  <div>
                    <div className="font-bold text-white">{track.title}</div>
                    <div className="text-sm text-gray-400">{track.artist} • {track.ticker}</div>
                  </div>
                </div>

                {/* Price */}
                <div className="col-span-2 flex items-center justify-end">
                  <span className="font-mono text-white">${track.price.toLocaleString()}</span>
                </div>

                {/* Change */}
                <div className="col-span-2 flex items-center justify-end">
                  <span className={`font-mono flex items-center gap-1 ${
                    track.change >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {track.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(track.change)}%
                  </span>
                </div>

                {/* Volume */}
                <div className="col-span-2 flex items-center justify-end">
                  <span className="font-mono text-gray-400">${track.volume}</span>
                </div>

                {/* Play Button */}
                <div className="col-span-1 flex items-center justify-end">
                  <button
                    onClick={() => setPlayingId(isPlaying ? null : track.ticker)}
                    className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/30 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 text-green-400" />
                    ) : (
                      <Play className="w-4 h-4 text-green-400" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
