// app/pricing/page.tsx
// IXXXI Subscription Tiers - Simple pricing for everyone

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import { Check, X, Zap, Crown, Sparkles, Music, Download, Globe, Radio, Shield, Users, Rocket, ArrowRight } from 'lucide-react';

interface PricingTier {
  id: string;
  name: string;
  description: string;
  price: number;
  priceYearly: number;
  icon: React.ReactNode;
  color: string;
  popular?: boolean;
  features: {
    text: string;
    included: boolean;
  }[];
  cta: string;
}

const TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for exploring the platform',
    price: 0,
    priceYearly: 0,
    icon: <Music size={24} />,
    color: '#888888',
    features: [
      { text: 'Stream all free tracks', included: true },
      { text: 'Basic audio quality (128kbps)', included: true },
      { text: 'Ad-supported experience', included: true },
      { text: 'Create up to 5 playlists', included: true },
      { text: 'Access to IXXXI TV', included: true },
      { text: 'Token-gated content', included: false },
      { text: 'Offline listening', included: false },
      { text: 'Lossless audio (FLAC)', included: false },
      { text: 'Early access releases', included: false },
    ],
    cta: 'Get Started'
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'For serious music lovers',
    price: 9.99,
    priceYearly: 99,
    icon: <Zap size={24} />,
    color: '#00ff88',
    popular: true,
    features: [
      { text: 'Everything in Free', included: true },
      { text: 'Ad-free experience', included: true },
      { text: 'HD audio quality (320kbps)', included: true },
      { text: 'Unlimited playlists', included: true },
      { text: 'Basic token-gated access', included: true },
      { text: 'Offline listening', included: true },
      { text: 'Priority support', included: true },
      { text: 'Lossless audio (FLAC)', included: false },
      { text: 'Early access releases', included: false },
    ],
    cta: 'Start Free Trial'
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Ultimate audiophile experience',
    price: 19.99,
    priceYearly: 199,
    icon: <Crown size={24} />,
    color: '#ffd700',
    features: [
      { text: 'Everything in Premium', included: true },
      { text: 'Lossless audio (FLAC/Hi-Res)', included: true },
      { text: 'All token-gated content', included: true },
      { text: 'Early access to new releases', included: true },
      { text: 'Exclusive artist AMAs', included: true },
      { text: 'VIP Discord access', included: true },
      { text: 'Concert ticket presales', included: true },
      { text: 'Custom visualizer themes', included: true },
      { text: 'API access for integrations', included: true },
    ],
    cta: 'Go Pro'
  },
];

const ARTIST_TIERS = [
  {
    id: 'artist-free',
    name: 'Artist Free',
    description: 'Start your journey',
    price: 0,
    features: [
      'Upload up to 10 tracks',
      'Basic analytics',
      'Standard revenue share (70%)',
      'Community support',
    ],
    cta: 'Apply Now'
  },
  {
    id: 'artist-pro',
    name: 'Artist Pro',
    description: 'Grow your fanbase',
    price: 14.99,
    features: [
      'Unlimited uploads',
      'Advanced analytics & insights',
      'Higher revenue share (85%)',
      'Priority playlist placement',
      'Token-gating tools',
      'Fan messaging',
      'Premiere releases',
      'Priority support',
    ],
    cta: 'Upgrade'
  },
];

export default function PricingPage() {
  const wallet = useWallet();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showArtistPricing, setShowArtistPricing] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="pt-20 pb-32 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold mb-4"
            >
              Simple, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">Transparent</span> Pricing
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-gray-400 max-w-2xl mx-auto"
            >
              No hidden fees. No locked content. Just music, the way it should be.
            </motion.p>
          </div>

          {/* Toggle: Listener / Artist */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 p-1 bg-white/5 rounded-xl">
              <button
                onClick={() => setShowArtistPricing(false)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition ${!showArtistPricing ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                For Listeners
              </button>
              <button
                onClick={() => setShowArtistPricing(true)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition ${showArtistPricing ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                For Artists
              </button>
            </div>
          </div>

          {/* Billing Cycle Toggle */}
          {!showArtistPricing && (
            <div className="flex justify-center mb-12">
              <div className="inline-flex items-center gap-3 p-1 bg-white/5 rounded-xl">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${billingCycle === 'monthly' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white'}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white'}`}
                >
                  Yearly
                  <span className="px-2 py-0.5 text-xs bg-green-500/30 text-green-400 rounded-full">Save 17%</span>
                </button>
              </div>
            </div>
          )}

          {/* Listener Pricing Cards */}
          {!showArtistPricing && (
            <div className="grid md:grid-cols-3 gap-6">
              {TIERS.map((tier, index) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative p-6 rounded-2xl border ${tier.popular ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 bg-white/5'}`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-green-500 text-black text-xs font-bold rounded-full">
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: tier.color + '20', color: tier.color }}>
                      {tier.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{tier.name}</h3>
                      <p className="text-sm text-gray-400">{tier.description}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        ${billingCycle === 'monthly' ? tier.price : (tier.priceYearly / 12).toFixed(2)}
                      </span>
                      <span className="text-gray-400">/mo</span>
                    </div>
                    {billingCycle === 'yearly' && tier.price > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        ${tier.priceYearly} billed annually
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        {feature.included ? (
                          <Check size={16} className="text-green-400 flex-shrink-0" />
                        ) : (
                          <X size={16} className="text-gray-600 flex-shrink-0" />
                        )}
                        <span className={feature.included ? 'text-gray-300' : 'text-gray-500'}>{feature.text}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-3 rounded-xl font-medium transition ${
                      tier.popular 
                        ? 'bg-green-500 text-black hover:bg-green-400' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {tier.cta}
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* Artist Pricing Cards */}
          {showArtistPricing && (
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {ARTIST_TIERS.map((tier, index) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 rounded-2xl border ${tier.price > 0 ? 'border-purple-500/50 bg-purple-500/5' : 'border-white/10 bg-white/5'}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                      {tier.price > 0 ? <Rocket size={24} /> : <Users size={24} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{tier.name}</h3>
                      <p className="text-sm text-gray-400">{tier.description}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${tier.price}</span>
                      <span className="text-gray-400">/mo</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <Check size={16} className="text-purple-400 flex-shrink-0" />
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/artist/apply"
                    className={`w-full py-3 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                      tier.price > 0 
                        ? 'bg-purple-500 text-white hover:bg-purple-400' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight size={16} />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {/* FAQ Section */}
          <div className="mt-20">
            <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="p-5 bg-white/5 rounded-xl">
                <h3 className="font-bold mb-2">Can I pay with crypto?</h3>
                <p className="text-gray-400 text-sm">Yes! We accept SOL, USDC, and other Solana tokens. Connect your wallet to see crypto payment options.</p>
              </div>
              <div className="p-5 bg-white/5 rounded-xl">
                <h3 className="font-bold mb-2">What's token-gated content?</h3>
                <p className="text-gray-400 text-sm">Some artists release exclusive content for holders of their NFTs or tokens. Premium unlocks basic gates; Pro unlocks all.</p>
              </div>
              <div className="p-5 bg-white/5 rounded-xl">
                <h3 className="font-bold mb-2">Can I cancel anytime?</h3>
                <p className="text-gray-400 text-sm">Absolutely. No contracts, no commitments. Cancel anytime and keep access until your billing period ends.</p>
              </div>
              <div className="p-5 bg-white/5 rounded-xl">
                <h3 className="font-bold mb-2">How does artist revenue work?</h3>
                <p className="text-gray-400 text-sm">Artists earn from streams and direct sales. Free artists get 70%, Pro artists get 85% — far better than traditional platforms.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-20 text-center">
            <div className="inline-block p-8 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl border border-white/10">
              <h2 className="text-2xl font-bold mb-2">Ready to experience music differently?</h2>
              <p className="text-gray-400 mb-6">Join thousands of listeners and artists on IXXXI</p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/signup" className="px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition">
                  Create Account
                </Link>
                <Link href="/discover" className="px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition">
                  Explore Music
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
