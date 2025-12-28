// app/trade/page.tsx
// IXXXI Trade - Simple music NFT exchange

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { ArrowUpDown, TrendingUp, TrendingDown, Search, Filter, RefreshCw, Wallet, ShoppingCart, Tag, Clock, ChevronDown, ExternalLink, Info } from 'lucide-react';

interface TrackListing {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  floorPrice: number;
  lastSale: number;
  change24h: number;
  volume24h: number;
  holders: number;
  supply: number;
  listed: number;
}

// Mock data for trading
const MOCK_LISTINGS: TrackListing[] = [
  { id: '1', title: 'Neon Pulse', artist: 'Digital Dreams', coverUrl: 'https://placehold.co/200x200/1a1a2e/00ff88?text=🎵', floorPrice: 0.5, lastSale: 0.52, change24h: 4.2, volume24h: 12.5, holders: 234, supply: 1000, listed: 45 },
  { id: '2', title: 'Midnight Run', artist: 'CyberWave', coverUrl: 'https://placehold.co/200x200/2d1b69/ff66b2?text=🌙', floorPrice: 1.2, lastSale: 1.15, change24h: -2.1, volume24h: 8.3, holders: 156, supply: 500, listed: 23 },
  { id: '3', title: 'Tokyo Drift', artist: 'Neon Tokyo', coverUrl: 'https://placehold.co/200x200/0d0d0d/ffcc00?text=🗼', floorPrice: 0.8, lastSale: 0.85, change24h: 12.5, volume24h: 25.6, holders: 412, supply: 2000, listed: 89 },
  { id: '4', title: 'Bass Drop', artist: 'SubWoofer', coverUrl: 'https://placehold.co/200x200/1a0a1a/00ccff?text=🔊', floorPrice: 0.3, lastSale: 0.28, change24h: -5.3, volume24h: 4.2, holders: 89, supply: 5000, listed: 156 },
  { id: '5', title: 'Starlight', artist: 'Cosmic Sound', coverUrl: 'https://placehold.co/200x200/0a1a2a/bb86fc?text=⭐', floorPrice: 2.5, lastSale: 2.48, change24h: 1.2, volume24h: 45.2, holders: 521, supply: 250, listed: 12 },
  { id: '6', title: 'Underground', artist: 'Dark Factory', coverUrl: 'https://placehold.co/200x200/1a1a1a/ff4444?text=🏭', floorPrice: 0.15, lastSale: 0.14, change24h: 8.7, volume24h: 2.1, holders: 67, supply: 10000, listed: 234 },
];

export default function TradePage() {
  const wallet = useWallet();
  const [listings, setListings] = useState<TrackListing[]>(MOCK_LISTINGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'volume' | 'change'>('volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedTrack, setSelectedTrack] = useState<TrackListing | null>(null);
  const [buyAmount, setBuyAmount] = useState(1);
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Filter and sort listings
  const filteredListings = listings
    .filter(l => l.title.toLowerCase().includes(searchQuery.toLowerCase()) || l.artist.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'price': valA = a.floorPrice; valB = b.floorPrice; break;
        case 'volume': valA = a.volume24h; valB = b.volume24h; break;
        case 'change': valA = a.change24h; valB = b.change24h; break;
        default: valA = 0; valB = 0;
      }
      return sortDir === 'desc' ? valB - valA : valA - valB;
    });

  const handleBuy = () => {
    if (!wallet.connected) {
      wallet.connect();
      return;
    }
    // Mock buy - would integrate with Solana
    alert(`Mock purchase: ${buyAmount}x ${selectedTrack?.title} for ${(selectedTrack?.floorPrice || 0) * buyAmount} SOL`);
    setShowBuyModal(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="pt-20 pb-32 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">Trade</h1>
              <p className="text-gray-400">Buy and sell music NFTs on the IXXXI marketplace</p>
            </div>
            
            {/* Stats Bar */}
            <div className="flex items-center gap-6 p-4 bg-white/5 rounded-xl">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">$147.2K</div>
                <div className="text-xs text-gray-500">24h Volume</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-bold">6,234</div>
                <div className="text-xs text-gray-500">Listings</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">847</div>
                <div className="text-xs text-gray-500">Artists</div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search tracks or artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'price' | 'volume' | 'change')}
                className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none appearance-none cursor-pointer"
              >
                <option value="volume">Volume</option>
                <option value="price">Price</option>
                <option value="change">24h Change</option>
              </select>
              
              <button
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition"
              >
                <ArrowUpDown size={18} className={sortDir === 'asc' ? 'rotate-180' : ''} />
              </button>
              
              <button className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Listings Table */}
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-white/5 text-xs text-gray-400 font-medium uppercase tracking-wider">
              <div className="col-span-4">Track</div>
              <div className="col-span-2 text-right">Floor Price</div>
              <div className="col-span-2 text-right">24h Change</div>
              <div className="col-span-2 text-right">Volume (24h)</div>
              <div className="col-span-2 text-right">Listed/Supply</div>
            </div>
            
            {/* Table Body */}
            <div className="divide-y divide-white/5">
              {filteredListings.map((listing, index) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => { setSelectedTrack(listing); setShowBuyModal(true); }}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 cursor-pointer transition"
                >
                  {/* Track Info */}
                  <div className="col-span-4 flex items-center gap-3">
                    <span className="text-gray-500 w-6">{index + 1}</span>
                    <img src={listing.coverUrl} alt={listing.title} className="w-12 h-12 rounded-lg object-cover" />
                    <div>
                      <div className="font-bold text-white">{listing.title}</div>
                      <div className="text-sm text-gray-400">{listing.artist}</div>
                    </div>
                  </div>
                  
                  {/* Floor Price */}
                  <div className="col-span-2 text-right">
                    <div className="font-mono text-white">{listing.floorPrice} SOL</div>
                    <div className="text-xs text-gray-500">${(listing.floorPrice * 150).toFixed(2)}</div>
                  </div>
                  
                  {/* 24h Change */}
                  <div className="col-span-2 text-right">
                    <div className={`flex items-center justify-end gap-1 font-mono ${listing.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {listing.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {listing.change24h >= 0 ? '+' : ''}{listing.change24h.toFixed(1)}%
                    </div>
                  </div>
                  
                  {/* Volume */}
                  <div className="col-span-2 text-right font-mono text-gray-300">
                    {listing.volume24h} SOL
                  </div>
                  
                  {/* Listed/Supply */}
                  <div className="col-span-2 text-right">
                    <div className="text-gray-300">{listing.listed} / {listing.supply}</div>
                    <div className="w-full h-1 bg-white/10 rounded-full mt-1">
                      <div 
                        className="h-full bg-green-500 rounded-full" 
                        style={{ width: `${(listing.listed / listing.supply) * 100}%` }} 
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-8 p-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl border border-white/10">
            <div className="flex items-start gap-4">
              <Info size={24} className="text-cyan-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2">How IXXXI Trading Works</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Each track on IXXXI can be minted as a limited edition NFT. Owning a track NFT gives you:
                </p>
                <ul className="grid md:grid-cols-2 gap-2 text-sm">
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    Exclusive high-quality audio access
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    Royalties from future streams
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    Voting rights on artist decisions
                  </li>
                  <li className="flex items-center gap-2 text-gray-300">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    Access to exclusive content
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Buy Modal */}
      <AnimatePresence>
        {showBuyModal && selectedTrack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowBuyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-gray-900 rounded-2xl border border-white/10 overflow-hidden"
            >
              {/* Track Preview */}
              <div className="p-6 bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="flex items-center gap-4">
                  <img src={selectedTrack.coverUrl} alt={selectedTrack.title} className="w-20 h-20 rounded-xl object-cover" />
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedTrack.title}</h3>
                    <p className="text-gray-400">{selectedTrack.artist}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                        {selectedTrack.listed} available
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buy Form */}
              <div className="p-6 space-y-4">
                {/* Price Info */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div>
                    <div className="text-sm text-gray-400">Floor Price</div>
                    <div className="text-2xl font-bold">{selectedTrack.floorPrice} SOL</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">≈ USD</div>
                    <div className="text-xl text-gray-300">${(selectedTrack.floorPrice * 150).toFixed(2)}</div>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setBuyAmount(Math.max(1, buyAmount - 1))}
                      className="p-3 bg-white/10 rounded-lg hover:bg-white/20 transition"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={selectedTrack.listed}
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(Math.max(1, Math.min(selectedTrack.listed, parseInt(e.target.value) || 1)))}
                      className="flex-1 text-center py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none"
                    />
                    <button 
                      onClick={() => setBuyAmount(Math.min(selectedTrack.listed, buyAmount + 1))}
                      className="p-3 bg-white/10 rounded-lg hover:bg-white/20 transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <span className="text-gray-300">Total</span>
                  <span className="text-2xl font-bold text-green-400">
                    {(selectedTrack.floorPrice * buyAmount).toFixed(2)} SOL
                  </span>
                </div>

                {/* Buy Button */}
                <button
                  onClick={handleBuy}
                  className="w-full py-4 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition flex items-center justify-center gap-2"
                >
                  {wallet.connected ? (
                    <>
                      <ShoppingCart size={20} />
                      Buy Now
                    </>
                  ) : (
                    <>
                      <Wallet size={20} />
                      Connect Wallet
                    </>
                  )}
                </button>

                {/* Cancel */}
                <button
                  onClick={() => setShowBuyModal(false)}
                  className="w-full py-3 text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
