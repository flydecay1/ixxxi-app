// app/premiere/[id]/page.tsx
// Music video premiere page with countdown, live chat, and purchase

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/context/ToastContext';

interface Premiere {
  id: string;
  title: string;
  description: string;
  artist: { id: string; name: string; avatarUrl: string | null };
  premiereAt: string;
  status: 'scheduled' | 'live' | 'ended';
  gateType: string;
  gateTokenAmount: number;
  viewerCount: number;
  maxViewers: number;
  price: { sol: number; token: number };
  thumbnail: string | null;
  videoUrl?: string;
}

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  timestamp: number;
  isArtist?: boolean;
}

export default function PremierePage() {
  const params = useParams();
  const premiereId = params.id as string;
  const wallet = useWallet();
  const { addToast } = useToast();
  
  const [premiere, setPremiere] = useState<Premiere | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [isPurchasing, setIsPurchasing] = useState(false);
  
  // Fetch premiere data
  useEffect(() => {
    async function fetchPremiere() {
      try {
        const res = await fetch(`/api/premiere/${premiereId}`);
        if (!res.ok) throw new Error('Premiere not found');
        const data = await res.json();
        setPremiere(data);
        
        // Check if user has access
        if (wallet.publicKey) {
          const accessRes = await fetch(
            `/api/premiere/${premiereId}/access?wallet=${wallet.publicKey.toBase58()}`
          );
          const accessData = await accessRes.json();
          setHasAccess(accessData.hasAccess);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchPremiere();
  }, [premiereId, wallet.publicKey]);
  
  // Countdown timer
  useEffect(() => {
    if (!premiere || premiere.status !== 'scheduled') return;
    
    const updateCountdown = () => {
      const now = Date.now();
      const target = new Date(premiere.premiereAt).getTime();
      const diff = Math.max(0, target - now);
      
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
      
      // Check if premiere should start
      if (diff === 0) {
        setPremiere(prev => prev ? { ...prev, status: 'live' } : null);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [premiere]);
  
  // Mock live chat (would use WebSockets in production)
  useEffect(() => {
    if (!premiere || premiere.status !== 'live') return;
    
    // Simulate incoming messages
    const interval = setInterval(() => {
      const mockMessages = [
        'This is fire 🔥',
        'Best premiere ever!',
        'The visuals are insane',
        'When is the album dropping?',
        'Love this artist ❤️',
      ];
      
      setChatMessages(prev => [
        ...prev.slice(-100), // Keep last 100 messages
        {
          id: Date.now().toString(),
          user: `user_${Math.random().toString(36).slice(2, 8)}`,
          message: mockMessages[Math.floor(Math.random() * mockMessages.length)],
          timestamp: Date.now(),
        }
      ]);
      
      // Update viewer count
      setViewerCount(prev => prev + Math.floor(Math.random() * 10) - 3);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [premiere?.status]);
  
  // Handle purchase
  const handlePurchase = async (method: 'sol' | 'token') => {
    if (!wallet.publicKey || !premiere) return;
    
    setIsPurchasing(true);
    try {
      // Get transaction
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.publicKey.toBase58(),
          contentId: premiereId,
          contentType: 'video',
          paymentMethod: method,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to create transaction');
      
      const { transaction, purchaseId, price, breakdown } = await res.json();
      
      // Decode and sign transaction
      const tx = Buffer.from(transaction, 'base64');
      
      // In production, use wallet.signTransaction
      addToast({ type: 'info', title: `Signing transaction for ${price} ${method === 'sol' ? 'SOL' : '$IXXXI'}...` });
      
      // Mock success for demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setHasAccess(true);
      addToast({ type: 'success', title: 'Purchase complete! Enjoy the premiere.' });
    } catch (err) {
      addToast({ type: 'error', title: err instanceof Error ? err.message : 'Purchase failed' });
    } finally {
      setIsPurchasing(false);
    }
  };
  
  // Send chat message
  const sendMessage = () => {
    if (!chatInput.trim() || !wallet.publicKey) return;
    
    setChatMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        user: wallet.publicKey!.toBase58().slice(0, 8),
        message: chatInput,
        timestamp: Date.now(),
      }
    ]);
    setChatInput('');
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!premiere) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Premiere Not Found</h1>
          <p className="text-gray-400">This premiere may have ended or been removed.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Video/Countdown Area */}
          <div className="lg:col-span-2">
            <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
              {premiere.status === 'scheduled' ? (
                // Countdown View
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/50 to-cyan-900/50">
                  {premiere.thumbnail && (
                    <img 
                      src={premiere.thumbnail}
                      alt={premiere.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
                    />
                  )}
                  <div className="relative z-10 text-center">
                    <p className="text-cyan-400 text-sm mb-2">PREMIERING IN</p>
                    <div className="flex gap-4 justify-center mb-6">
                      {[
                        { value: countdown.days, label: 'DAYS' },
                        { value: countdown.hours, label: 'HRS' },
                        { value: countdown.minutes, label: 'MIN' },
                        { value: countdown.seconds, label: 'SEC' },
                      ].map(({ value, label }) => (
                        <div key={label} className="text-center">
                          <div className="text-4xl md:text-6xl font-bold bg-black/50 px-4 py-2 rounded-lg">
                            {value.toString().padStart(2, '0')}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-gray-400">
                      {new Date(premiere.premiereAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : premiere.status === 'live' ? (
                // Live Video View
                hasAccess ? (
                  <div className="relative w-full h-full">
                    {/* Protected video player would go here */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <video
                        className="w-full h-full"
                        controls={false}
                        autoPlay
                        controlsList="nodownload noplaybackrate"
                        disablePictureInPicture
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <source src={premiere.videoUrl || ''} type="video/mp4" />
                      </video>
                    </div>
                    {/* Live indicator */}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-bold">LIVE</span>
                      <span className="text-sm text-gray-300">• {viewerCount} watching</span>
                    </div>
                  </div>
                ) : (
                  // Access Denied - Purchase Required
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur">
                    <div className="text-6xl mb-4">🔐</div>
                    <h2 className="text-2xl font-bold mb-2">Access Required</h2>
                    <p className="text-gray-400 mb-6 text-center max-w-md">
                      Purchase access to watch this exclusive premiere
                    </p>
                    {/* Purchase buttons */}
                    {!wallet.publicKey ? (
                      <button
                        onClick={() => wallet.connect()}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-medium"
                      >
                        Connect Wallet to Purchase
                      </button>
                    ) : (
                      <div className="flex gap-4">
                        <button
                          onClick={() => handlePurchase('sol')}
                          disabled={isPurchasing}
                          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium disabled:opacity-50"
                        >
                          {isPurchasing ? 'Processing...' : `${premiere.price.sol} SOL`}
                        </button>
                        <button
                          onClick={() => handlePurchase('token')}
                          disabled={isPurchasing}
                          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium disabled:opacity-50"
                        >
                          {isPurchasing ? 'Processing...' : `${premiere.price.token} $IXXXI`}
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                // Ended
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-400">This premiere has ended</p>
                    <button className="mt-4 px-6 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
                      Watch Recording
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Title and Artist */}
            <div className="mt-6">
              <h1 className="text-2xl font-bold">{premiere.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                  {premiere.artist.avatarUrl ? (
                    <img src={premiere.artist.avatarUrl} alt="" className="w-full h-full rounded-full" />
                  ) : '🎤'}
                </div>
                <span className="font-medium">{premiere.artist.name}</span>
              </div>
              <p className="text-gray-400 mt-4">{premiere.description}</p>
            </div>
          </div>
          
          {/* Live Chat */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-xl border border-gray-800 h-[600px] flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-800">
                <h2 className="font-bold flex items-center gap-2">
                  💬 Live Chat
                  {premiere.status === 'live' && (
                    <span className="text-xs text-gray-400">({viewerCount} viewers)</span>
                  )}
                </h2>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {premiere.status !== 'live' ? (
                  <div className="text-center text-gray-500 py-8">
                    Chat will be available when premiere goes live
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className="flex gap-2">
                      <span className={`font-medium ${msg.isArtist ? 'text-cyan-400' : 'text-purple-400'}`}>
                        {msg.user}:
                      </span>
                      <span className="text-gray-300">{msg.message}</span>
                    </div>
                  ))
                )}
              </div>
              
              {/* Chat Input */}
              {premiere.status === 'live' && hasAccess && (
                <div className="p-4 border-t border-gray-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Say something..."
                      className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <button
                      onClick={sendMessage}
                      className="px-4 py-2 bg-cyan-500 text-black rounded-lg font-medium hover:bg-cyan-400"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
