// app/profile/[wallet]/page.tsx
// User profile page - stats, listening history, stakes

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface UserStats {
  user: {
    walletAddress: string;
    username: string;
    tier: string;
    tokenBalance: number;
    memberSince: string;
  };
  listening: {
    period: string;
    totalPlays: number;
    totalListeningTime: number;
    uniqueArtists: number;
    topTracks: Array<{
      track: { id: string; title: string; artist: { name: string; avatarUrl: string | null } };
      count: number;
      duration: number;
    }>;
  };
  staking: {
    activeStakes: number;
    totalStaked: number;
    totalEarnings: number;
    stakes: Array<{
      artist: { id: string; name: string; avatarUrl: string | null };
      amount: number;
      earned: number;
      stakedAt: string;
    }>;
  };
  social: {
    following: number;
    followers: number;
    likes: number;
    playlists: number;
  };
}

interface UserProfile {
  id: string;
  walletAddress: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  tier: string;
  tokenBalance: number;
  createdAt: string;
  artist: {
    id: string;
    name: string;
    isVerified: boolean;
  } | null;
  _count: {
    plays: number;
    stakes: number;
    following: number;
    followers: number;
    likes: number;
    playlists: number;
  };
}

const tierColors: Record<string, string> = {
  free: 'text-gray-400',
  holder: 'text-blue-400',
  premium: 'text-purple-400',
  whale: 'text-yellow-400',
};

const tierBadges: Record<string, string> = {
  free: '🎧',
  holder: '💎',
  premium: '👑',
  whale: '🐋',
};

export default function ProfilePage() {
  const params = useParams();
  const wallet = useWallet();
  const walletAddress = params.wallet as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30d');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', bio: '' });

  const isOwnProfile = wallet.publicKey?.toBase58() === walletAddress;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch(`/api/user?wallet=${walletAddress}`),
          fetch(`/api/user/stats?wallet=${walletAddress}&period=${period}`)
        ]);

        if (!profileRes.ok) {
          if (profileRes.status === 404) {
            setError('User not found');
          } else {
            throw new Error('Failed to load profile');
          }
          return;
        }

        const profileData = await profileRes.json();
        const statsData = statsRes.ok ? await statsRes.json() : null;

        setProfile(profileData);
        setStats(statsData);
        setEditForm({ 
          username: profileData.username || '', 
          bio: profileData.bio || '' 
        });
      } catch (err) {
        setError('Failed to load profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [walletAddress, period]);

  const handleSaveProfile = async () => {
    if (!isOwnProfile) return;

    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          ...editForm
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(prev => prev ? { ...prev, ...updated } : null);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
          <p className="text-gray-400 mb-4">{error || 'This user does not exist'}</p>
          <Link 
            href="/"
            className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="relative h-48 bg-gradient-to-b from-cyan-900/30 to-transparent">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
      </div>

      {/* Profile Card */}
      <div className="max-w-6xl mx-auto px-4 -mt-24 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-800 p-6 mb-8"
        >
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 p-1">
                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center text-4xl">
                  {profile.avatarUrl ? (
                    <img 
                      src={profile.avatarUrl} 
                      alt={profile.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    tierBadges[profile.tier]
                  )}
                </div>
              </div>
              <div className={`absolute -bottom-1 -right-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-800 ${tierColors[profile.tier]}`}>
                {profile.tier.toUpperCase()}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                    className="text-2xl font-bold bg-gray-800 rounded px-2 py-1 border border-gray-700 focus:border-cyan-500 outline-none"
                  />
                ) : (
                  <h1 className="text-2xl font-bold">{profile.username}</h1>
                )}
                {profile.artist?.isVerified && (
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                    ✓ Verified Artist
                  </span>
                )}
              </div>
              
              <p className="text-gray-400 font-mono text-sm mb-3">
                {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
              </p>

              {isEditing ? (
                <textarea
                  value={editForm.bio}
                  onChange={e => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  className="w-full bg-gray-800 rounded px-3 py-2 border border-gray-700 focus:border-cyan-500 outline-none text-sm resize-none"
                  rows={3}
                />
              ) : (
                <p className="text-gray-300 text-sm mb-4">
                  {profile.bio || 'No bio yet'}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  Member since {formatDate(profile.createdAt)}
                </span>
                <span className="text-cyan-400 font-mono">
                  {profile.tokenBalance.toLocaleString()} $IXXXI
                </span>
              </div>
            </div>

            {/* Actions */}
            {isOwnProfile && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveProfile}
                      className="px-4 py-2 bg-cyan-500 text-black rounded-lg font-medium hover:bg-cyan-400 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6 pt-6 border-t border-gray-800">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile._count.plays}</p>
              <p className="text-xs text-gray-400">Plays</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile._count.likes}</p>
              <p className="text-xs text-gray-400">Likes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile._count.playlists}</p>
              <p className="text-xs text-gray-400">Playlists</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile._count.stakes}</p>
              <p className="text-xs text-gray-400">Stakes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile._count.following}</p>
              <p className="text-xs text-gray-400">Following</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile._count.followers}</p>
              <p className="text-xs text-gray-400">Followers</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Section */}
        {stats && (
          <>
            {/* Period Selector */}
            <div className="flex gap-2 mb-6">
              {['7d', '30d', '90d', 'all'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    period === p 
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {p === 'all' ? 'All Time' : `Last ${p.replace('d', ' days')}`}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Listening Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6"
              >
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="text-cyan-400">🎵</span> Listening Activity
                </h2>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-xl font-bold text-cyan-400">
                      {stats.listening.totalPlays}
                    </p>
                    <p className="text-xs text-gray-400">Plays</p>
                  </div>
                  <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-xl font-bold text-purple-400">
                      {formatTime(stats.listening.totalListeningTime)}
                    </p>
                    <p className="text-xs text-gray-400">Listen Time</p>
                  </div>
                  <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-xl font-bold text-green-400">
                      {stats.listening.uniqueArtists}
                    </p>
                    <p className="text-xs text-gray-400">Artists</p>
                  </div>
                </div>

                <h3 className="text-sm font-medium text-gray-400 mb-3">Top Tracks</h3>
                <div className="space-y-2">
                  {stats.listening.topTracks.slice(0, 5).map((item, i) => (
                    <div 
                      key={item.track.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition"
                    >
                      <span className="text-gray-500 w-4 text-sm">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.track.title}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {item.track.artist.name}
                        </p>
                      </div>
                      <span className="text-sm text-gray-400">{item.count} plays</span>
                    </div>
                  ))}
                  {stats.listening.topTracks.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No listening activity yet
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Staking Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 p-6"
              >
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="text-purple-400">💎</span> Staking Portfolio
                </h2>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-3 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-lg border border-purple-500/20">
                    <p className="text-xl font-bold text-purple-400">
                      {stats.staking.totalStaked.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">$IXXXI Staked</p>
                  </div>
                  <div className="text-center p-3 bg-gradient-to-br from-green-500/10 to-cyan-500/10 rounded-lg border border-green-500/20">
                    <p className="text-xl font-bold text-green-400">
                      +{stats.staking.totalEarnings.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">Earned</p>
                  </div>
                </div>

                <h3 className="text-sm font-medium text-gray-400 mb-3">Active Stakes</h3>
                <div className="space-y-2">
                  {stats.staking.stakes.map(stake => (
                    <div 
                      key={stake.artist.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                        {stake.artist.avatarUrl ? (
                          <img 
                            src={stake.artist.avatarUrl}
                            alt={stake.artist.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">🎤</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{stake.artist.name}</p>
                        <p className="text-xs text-gray-400">
                          Staked {formatDate(stake.stakedAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-purple-400">
                          {stake.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-green-400">
                          +{stake.earned.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {stats.staking.stakes.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-gray-500 text-sm mb-2">No active stakes</p>
                      <Link 
                        href="/discover"
                        className="text-cyan-400 text-sm hover:underline"
                      >
                        Discover artists to stake →
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}

        {/* Artist Section */}
        {profile.artist && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl border border-cyan-500/30 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>🎤</span> Artist Profile
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  This user is a verified artist on IXXXI
                </p>
              </div>
              <Link
                href={`/artist/${profile.artist.id}`}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition font-medium"
              >
                View Artist Page →
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
