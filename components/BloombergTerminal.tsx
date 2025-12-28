"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, TrendingDown, Activity, Zap, Globe, 
  ArrowUpRight, ArrowDownRight, Clock, Users, BarChart3 
} from "lucide-react";

interface Trade {
  id: string;
  type: "buy" | "sell";
  ticker: string;
  amount: number;
  price: number;
  timestamp: Date;
  wallet: string;
  region: string;
}

interface MarketStats {
  totalVolume24h: number;
  totalTrades24h: number;
  activeListeners: number;
  topGainer: { ticker: string; change: number };
  topLoser: { ticker: string; change: number };
}

// Generate mock trade data
function generateMockTrade(): Trade {
  const tickers = ["LOFI-BTC", "ETH-WAVE", "SOL-DRIP", "NFT-BASS", "DEFI-BEAT", "CHAIN-HOP"];
  const regions = ["NYC", "TOKYO", "BERLIN", "MIAMI", "LONDON", "SYDNEY"];
  const types: ("buy" | "sell")[] = ["buy", "sell"];
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    type: types[Math.floor(Math.random() * types.length)],
    ticker: tickers[Math.floor(Math.random() * tickers.length)],
    amount: Math.floor(Math.random() * 1000) + 10,
    price: Math.random() * 100 + 1,
    timestamp: new Date(),
    wallet: `${Math.random().toString(36).substr(2, 4)}...${Math.random().toString(36).substr(2, 4)}`,
    region: regions[Math.floor(Math.random() * regions.length)],
  };
}

// Live trade ticker
function TradeTicker({ trades }: { trades: Trade[] }) {
  return (
    <div className="h-full overflow-hidden">
      <AnimatePresence mode="popLayout">
        {trades.slice(0, 10).map((trade) => (
          <motion.div
            key={trade.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`flex items-center justify-between py-1 px-2 text-xs font-mono border-b border-gray-800 ${
              trade.type === "buy" ? "bg-green-500/5" : "bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-2">
              {trade.type === "buy" ? (
                <ArrowUpRight className="w-3 h-3 text-green-400" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-red-400" />
              )}
              <span className={trade.type === "buy" ? "text-green-400" : "text-red-400"}>
                {trade.type.toUpperCase()}
              </span>
              <span className="text-white">{trade.ticker}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400">{trade.amount.toLocaleString()} units</span>
              <span className="text-yellow-400">${trade.price.toFixed(2)}</span>
              <span className="text-gray-600">{trade.region}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Mini price chart
function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 100 50" className="w-full h-8">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Market stat card
function StatCard({ 
  label, 
  value, 
  change, 
  icon: Icon 
}: { 
  label: string; 
  value: string; 
  change?: number; 
  icon: React.ElementType;
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <Icon className="w-3 h-3 text-gray-600" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-lg font-bold text-white font-mono">{value}</span>
        {change !== undefined && (
          <span className={`text-xs font-mono ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// Main Bloomberg Terminal component
export default function BloombergTerminal({ className = "" }: { className?: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<MarketStats>({
    totalVolume24h: 2450000,
    totalTrades24h: 12847,
    activeListeners: 3421,
    topGainer: { ticker: "SOL-DRIP", change: 15.4 },
    topLoser: { ticker: "ETH-WAVE", change: -8.2 },
  });
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  // Generate initial price history
  useEffect(() => {
    const history = Array.from({ length: 20 }, () => Math.random() * 50 + 50);
    setPriceHistory(history);
  }, []);

  // Simulate live trades
  useEffect(() => {
    const interval = setInterval(() => {
      const newTrade = generateMockTrade();
      setTrades(prev => [newTrade, ...prev].slice(0, 50));
      
      // Update stats randomly
      setStats(prev => ({
        ...prev,
        totalVolume24h: prev.totalVolume24h + Math.random() * 10000,
        totalTrades24h: prev.totalTrades24h + 1,
        activeListeners: prev.activeListeners + Math.floor(Math.random() * 10) - 5,
      }));

      // Update price history
      setPriceHistory(prev => {
        const newPrice = prev[prev.length - 1] + (Math.random() - 0.5) * 5;
        return [...prev.slice(1), Math.max(0, newPrice)];
      });
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`bg-black border border-gray-800 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400 animate-pulse" />
          <span className="text-sm font-bold text-white">IXXXI TERMINAL</span>
          <span className="text-xs text-gray-500">v1.0.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400">LIVE</span>
          </div>
          <span className="text-xs font-mono text-gray-500">
            {new Date().toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-2 p-3 border-b border-gray-800">
        <StatCard 
          label="24h Volume" 
          value={`$${(stats.totalVolume24h / 1000000).toFixed(2)}M`}
          change={8.5}
          icon={BarChart3}
        />
        <StatCard 
          label="Total Trades" 
          value={stats.totalTrades24h.toLocaleString()}
          icon={Zap}
        />
        <StatCard 
          label="Listeners" 
          value={stats.activeListeners.toLocaleString()}
          icon={Users}
        />
        <StatCard 
          label="Top Gainer" 
          value={stats.topGainer.ticker}
          change={stats.topGainer.change}
          icon={TrendingUp}
        />
        <StatCard 
          label="Top Loser" 
          value={stats.topLoser.ticker}
          change={stats.topLoser.change}
          icon={TrendingDown}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 divide-x divide-gray-800">
        {/* Live Trades */}
        <div className="col-span-2">
          <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-800">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Live Trades
            </span>
          </div>
          <div className="h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
            <TradeTicker trades={trades} />
          </div>
        </div>

        {/* Chart */}
        <div>
          <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-800">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Market Index
            </span>
          </div>
          <div className="p-3">
            <div className="mb-2">
              <span className="text-2xl font-bold text-white font-mono">
                ${priceHistory[priceHistory.length - 1]?.toFixed(2) || "0.00"}
              </span>
              <span className="text-xs text-green-400 ml-2">+2.4%</span>
            </div>
            <MiniChart data={priceHistory} color="#22c55e" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">24h High</span>
                <div className="text-white font-mono">${Math.max(...priceHistory).toFixed(2)}</div>
              </div>
              <div>
                <span className="text-gray-500">24h Low</span>
                <div className="text-white font-mono">${Math.min(...priceHistory).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Ticker */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-900/80 border-t border-gray-800 overflow-x-auto">
        {["LOFI-BTC", "ETH-WAVE", "SOL-DRIP", "NFT-BASS"].map((ticker, i) => (
          <div key={ticker} className="flex items-center gap-2 text-xs font-mono whitespace-nowrap">
            <span className="text-white">{ticker}</span>
            <span className={i % 2 === 0 ? "text-green-400" : "text-red-400"}>
              {i % 2 === 0 ? "+" : "-"}{(Math.random() * 10).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact version for sidebar
export function CompactTerminal({ className = "" }: { className?: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrades(prev => [generateMockTrade(), ...prev].slice(0, 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`bg-black/50 border border-gray-800 rounded p-2 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3 h-3 text-green-400 animate-pulse" />
        <span className="text-xs text-gray-400">LIVE FEED</span>
      </div>
      {trades.map((trade) => (
        <div key={trade.id} className="flex items-center justify-between text-xs py-1">
          <span className={trade.type === "buy" ? "text-green-400" : "text-red-400"}>
            {trade.ticker}
          </span>
          <span className="text-gray-500">${trade.price.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
