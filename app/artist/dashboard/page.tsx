// app/artist/dashboard/page.tsx
// Artist dashboard - analytics, track management, earnings

'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardData {
  artist: {
    id: string;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    headerUrl: string | null;
    isVerified: boolean;
    tokenAddress: string | null;
    totalTracks: number;
    publishedTracks: number;
  };
  analytics: {
    period: string;
    totalPlays: number;
    uniqueListeners: number;
    totalStaked: number;
    stakerCount: number;
    followers: number;
    estimatedEarnings: number;
  };
  tracks: Array<{
    id: string;
    title: string;
    coverUrl: string | null;
    isPublished: boolean;
    gateType: string;
    totalPlays: number;
    totalLikes: number;
    periodPlays: number;
    periodDuration: number;
    createdAt: string;
  }>;
  topStakers: Array<{
    user: { walletAddress: string; username: string; avatarUrl: string | null };
    amount: number;
    stakedAt: string;
  }>;
  dailyStats: Array<{
    date: string;
    plays: number;
    uniqueListeners: number;
    revenue: number;
  }>;
}

export default function ArtistDashboard() {
  const wallet = useWallet();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'tracks' | 'stakers'>('overview');

  useEffect(() => {
    if (!wallet.publicKey) {
      setLoading(false);
      return;
    }

    async function fetchDashboard() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/artist/dashboard?wallet=${wallet.publicKey?.toBase58()}&period=${period}`
        );

        if (!res.ok) {
          if (res.status === 403) {
            setError('not-artist');
          } else {
            throw new Error('Failed to load dashboard');
          }
          return;
        }

        const dashboardData = await res.json();
        setData(dashboardData);
      } catch (err) {
        setError('failed');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [wallet.publicKey, period]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!wallet.publicKey) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎤</div>
          <h1 className="text-2xl font-bold text-white mb-2">Artist Dashboard</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to access your dashboard</p>
          <button
            onClick={() => wallet.connect()}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error === 'not-artist') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎵</div>
          <h1 className="text-2xl font-bold text-white mb-2">Become an Artist</h1>
          <p className="text-gray-400 mb-6">
            You&apos;re not registered as an artist yet. Apply to join IXXXI as a creator
            and start sharing your music with the world.
          </p>
          <Link
            href="/artist/apply"
            className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition"
          >
            Apply as Artist
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-400">Failed to load dashboard</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="relative">
        <div 
          className="h-48 bg-gradient-to-b from-purple-900/50 to-transparent"
          style={{
            backgroundImage: data.artist.headerUrl 
              ? `url(${data.artist.headerUrl})` 
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
        </div>

        <div className="max-w-7xl mx-auto px-4 -mt-16 relative z-10">
          <div className="flex items-end gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 p-1">
              <div className="w-full h-full rounded-full bg-gray-900 overflow-hidden">
                {data.artist.avatarUrl ? (
                  <img 
                    src={data.artist.avatarUrl}
                    alt={data.artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    🎤
                  </div>
                )}
              </div>
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{data.artist.name}</h1>
                {data.artist.isVerified && (
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm">Artist Dashboard</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Link
                href="/artist/upload"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition flex items-center gap-2"
              >
                <span>+</span> Upload Track
              </Link>
              <Link
                href="/artist/settings"
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 mt-8">
        {/* Period Selector & Tabs */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {(['overview', 'tracks', 'stakers'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                  activeTab === tab
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {['7d', '30d', '90d'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  period === p 
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {p.replace('d', 'D')}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                <StatCard 
                  label="Total Plays" 
                  value={formatNumber(data.analytics.totalPlays)}
                  color="cyan"
                />
                <StatCard 
                  label="Unique Listeners" 
                  value={formatNumber(data.analytics.uniqueListeners)}
                  color="purple"
                />
                <StatCard 
                  label="Followers" 
                  value={formatNumber(data.analytics.followers)}
                  color="pink"
                />
                <StatCard 
                  label="Total Staked" 
                  value={formatNumber(data.analytics.totalStaked)}
                  color="yellow"
                  suffix=" $IXXXI"
                />
                <StatCard 
                  label="Stakers" 
                  value={formatNumber(data.analytics.stakerCount)}
                  color="green"
                />
                <StatCard 
                  label="Est. Earnings" 
                  value={`$${data.analytics.estimatedEarnings.toFixed(2)}`}
                  color="emerald"
                />
              </div>

              {/* Chart & Recent Activity */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                  <h2 className="text-lg font-bold mb-4">Plays Over Time</h2>
                  <div className="h-64 flex items-end gap-1">
                    {data.dailyStats.length > 0 ? (
                      data.dailyStats.map((day, i) => {
                        const maxPlays = Math.max(...data.dailyStats.map(d => d.plays)) || 1;
                        const height = (day.plays / maxPlays) * 100;
                        return (
                          <div 
                            key={day.date} 
                            className="flex-1 flex flex-col items-center gap-1"
                          >
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${height}%` }}
                              transition={{ delay: i * 0.02 }}
                              className="w-full bg-gradient-to-t from-cyan-500 to-purple-500 rounded-t min-h-[4px]"
                              title={`${day.plays} plays`}
                            />
                            {i % 7 === 0 && (
                              <span className="text-[10px] text-gray-500">
                                {formatDate(day.date)}
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No data for this period
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Stakers */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                  <h2 className="text-lg font-bold mb-4">Top Supporters</h2>
                  <div className="space-y-3">
                    {data.topStakers.slice(0, 5).map((staker, i) => (
                      <div 
                        key={staker.user.walletAddress}
                        className="flex items-center gap-3"
                      >
                        <span className="text-gray-500 w-4 text-sm">{i + 1}</span>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xs">
                          {staker.user.avatarUrl ? (
                            <img 
                              src={staker.user.avatarUrl}
                              alt={staker.user.username}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            '👤'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {staker.user.username}
                          </p>
                        </div>
                        <span className="text-sm text-purple-400 font-mono">
                          {formatNumber(staker.amount)}
                        </span>
                      </div>
                    ))}
                    {data.topStakers.length === 0 && (
                      <p className="text-gray-500 text-sm text-center py-4">
                        No stakers yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tracks' && (
            <motion.div
              key="tracks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h2 className="font-bold">Your Tracks ({data.artist.totalTracks})</h2>
                  <Link
                    href="/artist/upload"
                    className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition"
                  >
                    + New Track
                  </Link>
                </div>
                <div className="divide-y divide-gray-800">
                  {data.tracks.map(track => (
                    <div 
                      key={track.id}
                      className="p-4 flex items-center gap-4 hover:bg-gray-800/30 transition"
                    >
                      <div className="w-12 h-12 rounded bg-gray-800 overflow-hidden flex-shrink-0">
                        {track.coverUrl ? (
                          <img 
                            src={track.coverUrl}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🎵
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{track.title}</p>
                          {!track.isPublished && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                              Draft
                            </span>
                          )}
                          {track.gateType !== 'none' && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                              {track.gateType === 'token' ? '🔒 Token' : '🎫 NFT'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          Added {formatDate(track.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatNumber(track.totalPlays)}</p>
                        <p className="text-xs text-gray-400">plays</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-pink-400">{formatNumber(track.totalLikes)}</p>
                        <p className="text-xs text-gray-400">likes</p>
                      </div>
                      <Link
                        href={`/artist/track/${track.id}/edit`}
                        className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition"
                      >
                        Edit
                      </Link>
                    </div>
                  ))}
                  {data.tracks.length === 0 && (
                    <div className="p-8 text-center">
                      <div className="text-4xl mb-2">🎵</div>
                      <p className="text-gray-400 mb-4">No tracks yet</p>
                      <Link
                        href="/artist/upload"
                        className="inline-block px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition"
                      >
                        Upload your first track
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'stakers' && (
            <motion.div
              key="stakers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                  <h2 className="font-bold">
                    Your Supporters ({data.analytics.stakerCount})
                  </h2>
                  <p className="text-sm text-gray-400">
                    Total staked: {formatNumber(data.analytics.totalStaked)} $IXXXI
                  </p>
                </div>
                <div className="divide-y divide-gray-800">
                  {data.topStakers.map((staker, i) => (
                    <Link
                      key={staker.user.walletAddress}
                      href={`/profile/${staker.user.walletAddress}`}
                      className="p-4 flex items-center gap-4 hover:bg-gray-800/30 transition block"
                    >
                      <span className="text-gray-500 w-6 text-center">{i + 1}</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                        {staker.user.avatarUrl ? (
                          <img 
                            src={staker.user.avatarUrl}
                            alt={staker.user.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>👤</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{staker.user.username}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          {staker.user.walletAddress.slice(0, 4)}...
                          {staker.user.walletAddress.slice(-4)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-400">
                          {formatNumber(staker.amount)} $IXXXI
                        </p>
                        <p className="text-xs text-gray-400">
                          Since {formatDate(staker.stakedAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {data.topStakers.length === 0 && (
                    <div className="p-8 text-center">
                      <div className="text-4xl mb-2">💎</div>
                      <p className="text-gray-400">No supporters yet</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Share your music to attract stakers
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  color, 
  suffix = '' 
}: { 
  label: string; 
  value: string; 
  color: string;
  suffix?: string;
}) {
  const colorMap: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
    pink: 'from-pink-500/20 to-pink-500/5 border-pink-500/30 text-pink-400',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-400',
    green: 'from-green-500/20 to-green-500/5 border-green-500/30 text-green-400',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400',
  };

  return (
    <div className={`bg-gradient-to-b ${colorMap[color]} border rounded-xl p-4`}>
      <p className={`text-2xl font-bold ${colorMap[color].split(' ').pop()}`}>
        {value}
        {suffix && <span className="text-sm font-normal">{suffix}</span>}
      </p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}
