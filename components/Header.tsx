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
      <header className="fixed top-0 left-0 w-full h-16 bg-black/80 backdrop-blur-xl border-b border-gray-800 flex items-center justify-between px-4 md:px-6 z-40">
        {/* LEFT: LOGO */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">IX</span>
          </div>
          <span className="text-white font-bold text-lg hidden sm:block">IXXXI</span>
        </Link>

        {/* CENTER: NAV (Desktop) */}
        <nav className="hidden md:flex items-center gap-5">
          <Link href="/discover" className="text-gray-400 hover:text-white transition text-sm">
            Discover
          </Link>
          <Link href="/charts" className="text-gray-400 hover:text-white transition text-sm">
            Charts
          </Link>
          <Link href="/trade" className="text-gray-400 hover:text-white transition text-sm flex items-center gap-1">
            <span>Trade</span>
            <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">NEW</span>
          </Link>
          <Link href="/tv" className="text-gray-400 hover:text-white transition text-sm">
            TV
          </Link>
          <Link href="/pricing" className="text-gray-400 hover:text-white transition text-sm">
            Pricing
          </Link>
          {user?.isArtist && (
            <Link href="/artist/dashboard" className="text-cyan-400 hover:text-cyan-300 transition text-sm font-medium">
              Dashboard
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
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-800 hover:bg-gray-700 transition"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-xs">
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
                <svg className={`w-4 h-4 text-gray-400 transition ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden">
                  {/* User info */}
                  <div className="p-4 border-b border-gray-800">
                    <p className="text-white font-medium truncate">{user.username}</p>
                    <p className="text-gray-500 text-xs truncate">{user.email || `${user.walletAddress.slice(0, 8)}...`}</p>
                    <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs ${currentTier.color} bg-gray-800`}>
                      <span>{currentTier.icon}</span>
                      <span>{currentTier.label}</span>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="p-2">
                    <Link
                      href={`/profile/${user.walletAddress}`}
                      onClick={() => setShowDropdown(false)}
                      className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition"
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/library"
                      onClick={() => setShowDropdown(false)}
                      className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition"
                    >
                      My Library
                    </Link>
                    {user.isArtist ? (
                      <Link
                        href="/artist/dashboard"
                        onClick={() => setShowDropdown(false)}
                        className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition"
                      >
                        Artist Dashboard
                      </Link>
                    ) : (
                      <Link
                        href="/artist/apply"
                        onClick={() => setShowDropdown(false)}
                        className="block px-3 py-2 text-cyan-400 hover:text-cyan-300 hover:bg-gray-800 rounded-lg text-sm transition"
                      >
                        Become an Artist
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      onClick={() => setShowDropdown(false)}
                      className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition"
                    >
                      Settings
                    </Link>
                  </div>

                  {/* Upgrade CTA */}
                  {user.tier === 'free' && (
                    <div className="p-2 border-t border-gray-800">
                      <Link
                        href="/upgrade"
                        onClick={() => setShowDropdown(false)}
                        className="block px-3 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 hover:from-cyan-500/30 hover:to-purple-500/30 rounded-lg text-sm text-center transition"
                      >
                        ✨ Upgrade to Premium
                      </Link>
                    </div>
                  )}

                  {/* Logout */}
                  <div className="p-2 border-t border-gray-800">
                    <button
                      onClick={() => { logout(); setShowDropdown(false); }}
                      className="w-full px-3 py-2 text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg text-sm text-left transition"
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
                className="px-4 py-2 text-white text-sm font-medium hover:text-cyan-400 transition"
              >
                Sign in
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-medium rounded-full hover:opacity-90 transition"
              >
                Get started
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