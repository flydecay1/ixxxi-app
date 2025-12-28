// components/PurchaseModal.tsx
// Modal for purchasing tracks with SOL or USDC

'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePurchaseTrack, useSOLBalance, useTokenBalance } from '@/hooks/useWeb3';

interface Track {
  id: string;
  title: string;
  artist: string;
  artistWallet: string;
  coverUrl?: string;
  price?: number;
  priceSOL?: number;
}

interface PurchaseModalProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (signature: string) => void;
}

export function PurchaseModal({ track, isOpen, onClose, onSuccess }: PurchaseModalProps) {
  const { connected, publicKey } = useWallet();
  const { balance: solBalance } = useSOLBalance();
  const { balance: usdcBalance } = useTokenBalance();
  const { purchase, loading, error } = usePurchaseTrack();
  
  const [currency, setCurrency] = useState<'SOL' | 'USDC'>('SOL');
  const [step, setStep] = useState<'select' | 'confirm' | 'processing' | 'success' | 'error'>('select');
  const [txSignature, setTxSignature] = useState<string | null>(null);

  if (!isOpen) return null;

  const priceUSD = track.price || 0.99;
  const priceSOL = track.priceSOL || 0.006; // ~$0.99 at $150/SOL
  const displayPrice = currency === 'SOL' ? `${priceSOL} SOL` : `$${priceUSD} USDC`;
  
  const hasEnough = currency === 'SOL' 
    ? solBalance >= priceSOL 
    : usdcBalance >= priceUSD;

  const handlePurchase = async () => {
    setStep('processing');
    
    const result = await purchase(track.id, currency);
    
    if (result.success && result.signature) {
      setTxSignature(result.signature);
      setStep('success');
      onSuccess?.(result.signature);
    } else {
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('select');
    setTxSignature(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">
            {step === 'success' ? 'Purchase Complete!' : 'Purchase Track'}
          </h2>
          <button 
            onClick={handleClose}
            className="text-zinc-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Track Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
              {track.coverUrl ? (
                <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">{track.title}</h3>
              <p className="text-zinc-400 text-sm truncate">{track.artist}</p>
            </div>
          </div>

          {step === 'select' && (
            <>
              {/* Currency Selection */}
              <div className="space-y-2 mb-6">
                <label className="text-sm text-zinc-400">Pay with</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCurrency('SOL')}
                    className={`p-3 rounded-lg border transition ${
                      currency === 'SOL'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-green-400" />
                      <span className="text-white font-medium">SOL</span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">{priceSOL} SOL</p>
                    <p className="text-xs text-zinc-500">Balance: {solBalance.toFixed(4)}</p>
                  </button>
                  
                  <button
                    onClick={() => setCurrency('USDC')}
                    className={`p-3 rounded-lg border transition ${
                      currency === 'USDC'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        $
                      </div>
                      <span className="text-white font-medium">USDC</span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">${priceUSD}</p>
                    <p className="text-xs text-zinc-500">Balance: ${usdcBalance.toFixed(2)}</p>
                  </button>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-zinc-800/50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between text-zinc-300">
                  <span>Track Price</span>
                  <span>{displayPrice}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Artist (90%)</span>
                  <span>{currency === 'SOL' ? `${(priceSOL * 0.9).toFixed(4)} SOL` : `$${(priceUSD * 0.9).toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Platform Fee (10%)</span>
                  <span>{currency === 'SOL' ? `${(priceSOL * 0.1).toFixed(4)} SOL` : `$${(priceUSD * 0.1).toFixed(2)}`}</span>
                </div>
                <div className="border-t border-zinc-700 pt-2 flex justify-between text-white font-medium">
                  <span>Total</span>
                  <span>{displayPrice}</span>
                </div>
              </div>

              {/* Insufficient Balance Warning */}
              {!hasEnough && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
                  Insufficient {currency} balance. You need {currency === 'SOL' ? `${priceSOL} SOL` : `$${priceUSD} USDC`}.
                </div>
              )}

              {/* Purchase Button */}
              <button
                onClick={() => setStep('confirm')}
                disabled={!connected || !hasEnough}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!connected ? 'Connect Wallet' : !hasEnough ? 'Insufficient Balance' : `Pay ${displayPrice}`}
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Confirm Purchase</h3>
                <p className="text-zinc-400">
                  You&apos;re about to pay <span className="text-white font-medium">{displayPrice}</span> for this track.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 py-3 border border-zinc-600 text-white rounded-lg hover:bg-zinc-800 transition"
                >
                  Back
                </button>
                <button
                  onClick={handlePurchase}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:opacity-90 transition"
                >
                  Confirm
                </button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 rounded-full border-4 border-zinc-700" />
                <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Processing Payment</h3>
              <p className="text-zinc-400 text-sm">
                Please approve the transaction in your wallet...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Purchase Complete!</h3>
              <p className="text-zinc-400 mb-4">
                You now own &quot;{track.title}&quot;
              </p>
              
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-400 hover:text-purple-300 underline"
                >
                  View Transaction →
                </a>
              )}
              
              <button
                onClick={handleClose}
                className="w-full mt-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition"
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Purchase Failed</h3>
              <p className="text-zinc-400 mb-4">
                {error || 'Something went wrong. Please try again.'}
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 border border-zinc-600 text-white rounded-lg hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-800/50 border-t border-zinc-800 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          Secured by Solana blockchain
        </div>
      </div>
    </div>
  );
}
