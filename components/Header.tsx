"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "./auth/AuthModal";

// Dynamically import wallet button (for power users)
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletOption, setShowWalletOption] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // User-friendly tier display
  const tierDisplay: Record<string, { label: string; color: string; icon: string }> = {
    free: { label: 'Free', color: 'text-gray-400', icon: '🎧' },
    holder: { label: 'Member', color: 'text-blue-400', icon: '💎' },
    premium: { label: 'Premium', color: 'text-purple-400', icon: '👑' },
    whale: { label: 'VIP', color: 'text-yellow-400', icon: '🐋' },
  };

  const currentTier = tierDisplay[user?.tier || 'free'];

  return (
    <>
      <header className="fixed top-0 left-0 w-full h-16 glass-dark backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-4 md:px-6 z-40 shadow-lg">
        {/* LEFT: LOGO */}
        <Link href="/" className="flex items-center gap-3 hover:scale-105 transition-transform duration-300 group">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
            <span className="text-white font-bold text-sm">IX</span>
          </div>
          <span className="text-white font-bold text-lg hidden sm:block gradient-text">IXXXI</span>
        </Link>

        {/* CENTER: NAV (Desktop) */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/discover" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm font-medium relative group">
            <span>Discover</span>
            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500 group-hover:w-full transition-all duration-300"></div>
          </Link>
          <Link href="/charts" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm font-medium relative group">
            <span>Charts</span>
            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500 group-hover:w-full transition-all duration-300"></div>
          </Link>
          <Link href="/trade" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm font-medium flex items-center gap-2 relative group">
            <span>Trade</span>
            <span className="px-2 py-0.5 text-[9px] font-semibold bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 rounded-full ring-1 ring-cyan-500/30">NEW</span>
            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500 group-hover:w-full transition-all duration-300"></div>
          </Link>
          <Link href="/tv" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm font-medium relative group">
            <span>TV</span>
            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500 group-hover:w-full transition-all duration-300"></div>
          </Link>
          <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors duration-200 text-sm font-medium relative group">
            <span>Pricing</span>
            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500 group-hover:w-full transition-all duration-300"></div>
          </Link>
          {user?.isArtist && (
            <Link href="/artist/dashboard" className="text-cyan-400 hover:text-cyan-300 transition-colors duration-200 text-sm font-semibold relative group">
              <span>Dashboard</span>
              <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-400 to-purple-500"></div>
            </Link>
          )}
        </nav>

        {/* RIGHT: AUTH */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            // Logged in state
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-full glass border border-white/10 hover:bg-white/5 transition-all duration-300 hover:scale-105"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center text-xs shadow-lg shadow-cyan-500/20 ring-2 ring-white/10">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    currentTier.icon
                  )}
                </div>
                {/* Name (desktop) */}
                <span className="text-white text-sm font-medium hidden sm:block max-w-[100px] truncate">
                  {user.username}
                </span>
                {/* Dropdown arrow */}
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute right-0 mt-3 w-64 glass-strong border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                  {/* User info */}
                  <div className="p-4 border-b border-white/10 bg-gradient-to-br from-cyan-500/5 to-purple-500/5">
                    <p className="text-white font-semibold truncate">{user.username}</p>
                    <p className="text-gray-400 text-xs truncate mt-1">{user.email || `${user.walletAddress.slice(0, 8)}...`}</p>
                    <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs ${currentTier.color} glass ring-1 ring-white/10`}>
                      <span>{currentTier.icon}</span>
                      <span className="font-medium">{currentTier.label}</span>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="p-2">
                    <Link
                      href={`/profile/${user.walletAddress}`}
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl text-sm transition-all duration-200 font-medium"
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/library"
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl text-sm transition-all duration-200 font-medium"
                    >
                      My Library
                    </Link>
                    {user.isArtist ? (
                      <Link
                        href="/artist/dashboard"
                        onClick={() => setShowDropdown(false)}
                        className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl text-sm transition-all duration-200 font-medium"
                      >
                        Artist Dashboard
                      </Link>
                    ) : (
                      <Link
                        href="/artist/apply"
                        onClick={() => setShowDropdown(false)}
                        className="block px-4 py-2.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-xl text-sm transition-all duration-200 font-medium"
                      >
                        Become an Artist
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      onClick={() => setShowDropdown(false)}
                      className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl text-sm transition-all duration-200 font-medium"
                    >
                      Settings
                    </Link>
                  </div>

                  {/* Upgrade CTA */}
                  {user.tier === 'free' && (
                    <div className="p-2 border-t border-white/10">
                      <Link
                        href="/upgrade"
                        onClick={() => setShowDropdown(false)}
                        className="block px-4 py-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 hover:from-cyan-500/30 hover:to-purple-500/30 rounded-xl text-sm text-center transition-all duration-200 font-semibold ring-1 ring-cyan-500/30 hover:ring-cyan-500/50"
                      >
                        ✨ Upgrade to Premium
                      </Link>
                    </div>
                  )}

                  {/* Logout */}
                  <div className="p-2 border-t border-white/10">
                    <button
                      onClick={() => { logout(); setShowDropdown(false); }}
                      className="w-full px-4 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl text-sm text-left transition-all duration-200 font-medium"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Logged out state
            <>
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 text-gray-300 text-sm font-medium hover:text-white transition-colors duration-200"
              >
                Sign in
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                className="relative px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-semibold rounded-full hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-300 overflow-hidden group"
              >
                <span className="relative z-10">Get started</span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
              
              {/* Hidden wallet button for power users (shown on Ctrl+Shift+W) */}
              {showWalletOption && (
                <div className="wallet-adapter-wrapper">
                  <WalletMultiButton />
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          window.location.reload(); // Refresh to update user state
        }}
      />

      {/* Keyboard shortcut for wallet option */}
      <style jsx global>{`
        .wallet-adapter-button {
          background: linear-gradient(135deg, #06b6d4, #8b5cf6) !important;
          border: none !important;
          border-radius: 9999px !important;
          height: 40px !important;
          font-size: 13px !important;
          padding: 0 16px !important;
        }
        .wallet-adapter-button:hover {
          opacity: 0.9 !important;
        }
      `}</style>
    </>
  );
}