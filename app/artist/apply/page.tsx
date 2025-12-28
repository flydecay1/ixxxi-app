// app/artist/apply/page.tsx
// Artist application page - become an artist on IXXXI

'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { motion } from 'framer-motion';

export default function ArtistApplyPage() {
  const wallet = useWallet();
  const router = useRouter();
  const { user, isArtist, refreshUser } = useUser();
  
  const [form, setForm] = useState({
    name: '',
    bio: '',
    genre: '',
    website: '',
    twitter: '',
    instagram: '',
    spotifyUrl: '',
    soundcloudUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/artist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.publicKey.toBase58(),
          ...form,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create artist profile');
      }

      setSuccess(true);
      await refreshUser();
      
      // Redirect after a moment
      setTimeout(() => {
        router.push('/artist/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎤</div>
          <h1 className="text-2xl font-bold text-white mb-2">Become an Artist</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to apply</p>
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

  if (isArtist) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-white mb-2">Already an Artist!</h1>
          <p className="text-gray-400 mb-6">You already have an artist profile</p>
          <button
            onClick={() => router.push('/artist/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to IXXXI!</h1>
          <p className="text-gray-400 mb-6">Your artist profile has been created</p>
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm mt-4">Redirecting to dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-block text-6xl mb-4"
          >
            🎤
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold mb-4"
          >
            Become an Artist
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 text-lg"
          >
            Join IXXXI and share your music with the world
          </motion.p>
        </div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-4 mb-12"
        >
          {[
            { icon: '💰', title: '90% Revenue', desc: 'Keep most of your earnings' },
            { icon: '🔐', title: 'Token Gate', desc: 'Exclusive content for holders' },
            { icon: '📊', title: 'Analytics', desc: 'Real-time listener insights' },
          ].map((benefit, i) => (
            <div 
              key={i}
              className="text-center p-4 bg-gray-900/50 rounded-xl border border-gray-800"
            >
              <div className="text-3xl mb-2">{benefit.icon}</div>
              <h3 className="font-bold text-sm mb-1">{benefit.title}</h3>
              <p className="text-xs text-gray-400">{benefit.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onSubmit={handleSubmit}
          className="bg-gray-900/50 rounded-2xl border border-gray-800 p-8"
        >
          <div className="space-y-6">
            {/* Artist Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Artist Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your artist/stage name"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell your story..."
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition resize-none"
              />
            </div>

            {/* Genre */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Primary Genre
              </label>
              <select
                value={form.genre}
                onChange={e => setForm(prev => ({ ...prev, genre: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
              >
                <option value="">Select a genre</option>
                <option value="electronic">Electronic</option>
                <option value="hip-hop">Hip-Hop</option>
                <option value="pop">Pop</option>
                <option value="rock">Rock</option>
                <option value="r&b">R&B</option>
                <option value="indie">Indie</option>
                <option value="jazz">Jazz</option>
                <option value="classical">Classical</option>
                <option value="ambient">Ambient</option>
                <option value="experimental">Experimental</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Social Links */}
            <div className="pt-4 border-t border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-4">
                Social Links <span className="text-gray-500">(optional)</span>
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Website</label>
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://yoursite.com"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Twitter</label>
                  <input
                    type="text"
                    value={form.twitter}
                    onChange={e => setForm(prev => ({ ...prev, twitter: e.target.value }))}
                    placeholder="@username"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Instagram</label>
                  <input
                    type="text"
                    value={form.instagram}
                    onChange={e => setForm(prev => ({ ...prev, instagram: e.target.value }))}
                    placeholder="@username"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Spotify</label>
                  <input
                    type="url"
                    value={form.spotifyUrl}
                    onChange={e => setForm(prev => ({ ...prev, spotifyUrl: e.target.value }))}
                    placeholder="Spotify artist URL"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !form.name}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-bold text-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Profile...
                </span>
              ) : (
                'Create Artist Profile'
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              By creating an artist profile, you agree to our Terms of Service and understand 
              that your content will be publicly available on the IXXXI platform.
            </p>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
