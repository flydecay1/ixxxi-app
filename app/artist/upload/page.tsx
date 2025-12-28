// app/artist/upload/page.tsx
// Artist track upload page

'use client';

import { useState, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { 
  Upload, Music, Image, MapPin, Lock, DollarSign, 
  X, Check, AlertCircle, ChevronLeft, Loader2,
  Play, Pause
} from 'lucide-react';

const GENRES = [
  'Electronic', 'House', 'Techno', 'Ambient', 'Lo-Fi',
  'Hip-Hop', 'R&B', 'Pop', 'Rock', 'Jazz',
  'Classical', 'World', 'Experimental', 'Other'
];

const GATE_TYPES = [
  { id: 'none', label: 'Free Access', description: 'Anyone can stream', icon: '🌍' },
  { id: 'token', label: 'Token Gate', description: 'Require token balance', icon: '🪙' },
  { id: 'nft', label: 'NFT Gate', description: 'Require NFT ownership', icon: '🎨' },
  { id: 'paid', label: 'Paid Access', description: 'One-time purchase', icon: '💳' },
];

export default function UploadPage() {
  const wallet = useWallet();
  const router = useRouter();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Form state
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Track data
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [region, setRegion] = useState('');
  
  const [gateType, setGateType] = useState('none');
  const [gateTokenMint, setGateTokenMint] = useState('');
  const [gateTokenAmount, setGateTokenAmount] = useState('');
  const [priceSOL, setPriceSOL] = useState('');

  // Handle audio file selection
  const handleAudioSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav'];
    if (!validTypes.includes(file.type)) {
      setError('Please select an MP3, WAV, or FLAC file');
      return;
    }
    
    // Validate size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      setError('File too large. Maximum size is 100MB');
      return;
    }
    
    setAudioFile(file);
    setError(null);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setAudioPreview(url);
    
    // Get duration
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(Math.round(audio.duration));
    });
    
    // Auto-fill title from filename
    if (!title) {
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      setTitle(name);
    }
  }, [title]);

  // Handle cover file selection
  const handleCoverSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image');
      return;
    }
    
    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Maximum size is 10MB');
      return;
    }
    
    setCoverFile(file);
    setError(null);
    
    // Create preview
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  }, []);

  // Toggle audio preview
  const toggleAudioPreview = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Generate ticker from title
  const generateTicker = (title: string) => {
    const words = title.split(' ').filter(w => w.length > 2);
    if (words.length >= 2) {
      return `$${words[0].slice(0, 3).toUpperCase()}-${words[1].slice(0, 3).toUpperCase()}`;
    }
    return `$${title.slice(0, 6).toUpperCase().replace(/\s/g, '')}`;
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!wallet.publicKey || !audioFile) {
      setError('Missing required data');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('walletAddress', wallet.publicKey.toBase58());
      formData.append('audio', audioFile);
      if (coverFile) formData.append('cover', coverFile);
      formData.append('title', title);
      formData.append('ticker', ticker || generateTicker(title));
      formData.append('description', description);
      formData.append('genre', genre);
      formData.append('region', region);
      formData.append('gateType', gateType);
      if (gateTokenMint) formData.append('gateTokenMint', gateTokenMint);
      if (gateTokenAmount) formData.append('gateTokenAmount', gateTokenAmount);
      if (priceSOL) formData.append('priceSOL', priceSOL);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      
      setSuccess(true);
      
      // Redirect to dashboard after delay
      setTimeout(() => {
        router.push('/artist/dashboard');
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Validate current step
  const canProceed = () => {
    switch (step) {
      case 1: return !!audioFile;
      case 2: return !!title && !!genre;
      case 3: return true; // Gate settings optional
      default: return false;
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <Music size={48} className="mx-auto mb-4 text-gray-600" />
            <h1 className="text-2xl font-bold mb-2">Upload Track</h1>
            <p className="text-gray-400 mb-6">Connect your wallet to upload music</p>
            <button
              onClick={() => wallet.connect()}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-medium hover:opacity-90 transition"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check size={40} className="text-green-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Upload Complete!</h1>
            <p className="text-gray-400 mb-4">Your track is being processed</p>
            <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-32">
        {/* Back button */}
        <Link 
          href="/artist/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-6"
        >
          <ChevronLeft size={20} />
          Back to Dashboard
        </Link>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition ${
                s === step ? 'bg-cyan-500 scale-125' : 
                s < step ? 'bg-cyan-500/50' : 'bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Hidden inputs */}
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/flac,audio/mp3"
          onChange={handleAudioSelect}
          className="hidden"
        />
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverSelect}
          className="hidden"
        />
        
        {/* Hidden audio for preview */}
        {audioPreview && (
          <audio
            ref={audioRef}
            src={audioPreview}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}

        {/* Error display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
            >
              <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto">
                <X size={16} className="text-red-400" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: File Upload */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold mb-2">Upload Your Track</h1>
            <p className="text-gray-400 mb-8">Select an audio file to upload (MP3, WAV, or FLAC)</p>
            
            {/* Audio upload area */}
            <div 
              onClick={() => audioInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition ${
                audioFile 
                  ? 'border-cyan-500/50 bg-cyan-500/5' 
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              {audioFile ? (
                <div>
                  <div className="w-16 h-16 mx-auto mb-4 bg-cyan-500/20 rounded-full flex items-center justify-center">
                    <Music size={32} className="text-cyan-400" />
                  </div>
                  <p className="font-medium text-white mb-1">{audioFile.name}</p>
                  <p className="text-sm text-gray-400">
                    {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                    {audioDuration > 0 && ` • ${formatDuration(audioDuration)}`}
                  </p>
                  
                  {audioPreview && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAudioPreview(); }}
                      className="mt-4 px-4 py-2 bg-white/10 rounded-lg flex items-center gap-2 mx-auto hover:bg-white/20 transition"
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                      {isPlaying ? 'Pause' : 'Preview'}
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <Upload size={48} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400 mb-2">Drag & drop or click to select</p>
                  <p className="text-xs text-gray-600">MP3, WAV, FLAC • Max 100MB</p>
                </div>
              )}
            </div>

            {/* Cover art upload */}
            <div className="mt-6">
              <h3 className="font-medium mb-3">Cover Art (Optional)</h3>
              <div className="flex items-center gap-4">
                <div 
                  onClick={() => coverInputRef.current?.click()}
                  className={`w-32 h-32 rounded-xl border-2 border-dashed cursor-pointer flex items-center justify-center overflow-hidden ${
                    coverPreview ? 'border-transparent' : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <Image size={32} className="text-gray-600" />
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  <p>Square image recommended</p>
                  <p>JPEG, PNG, or WebP • Max 10MB</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Metadata */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold mb-2">Track Details</h1>
            <p className="text-gray-400 mb-8">Tell us about your track</p>
            
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Awesome Track"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              {/* Ticker */}
              <div>
                <label className="block text-sm font-medium mb-2">Ticker Symbol</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    placeholder={title ? generateTicker(title).replace('$', '') : 'TRACK-001'}
                    maxLength={12}
                    className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500 uppercase"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Used for trading. Auto-generated if left empty.</p>
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell the story behind this track..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
              
              {/* Genre */}
              <div>
                <label className="block text-sm font-medium mb-2">Genre *</label>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map(g => (
                    <button
                      key={g}
                      onClick={() => setGenre(g)}
                      className={`px-4 py-2 rounded-lg text-sm transition ${
                        genre === g 
                          ? 'bg-cyan-500 text-black' 
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Region */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <MapPin size={14} className="inline mr-1" />
                  Location (Optional)
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. TOKYO, JP or LOS ANGELES, USA"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500"
                />
                <p className="text-xs text-gray-500 mt-1">Where was this track created? Shows on the globe.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Access Control */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold mb-2">Access Control</h1>
            <p className="text-gray-400 mb-8">Choose who can listen to your track</p>
            
            {/* Gate type selection */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {GATE_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setGateType(type.id)}
                  className={`p-4 rounded-xl border text-left transition ${
                    gateType === type.id 
                      ? 'border-cyan-500 bg-cyan-500/10' 
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{type.icon}</span>
                  <h3 className="font-medium">{type.label}</h3>
                  <p className="text-sm text-gray-400">{type.description}</p>
                </button>
              ))}
            </div>
            
            {/* Gate settings */}
            <AnimatePresence mode="wait">
              {gateType === 'token' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div>
                    <label className="block text-sm font-medium mb-2">Token Mint Address</label>
                    <input
                      type="text"
                      value={gateTokenMint}
                      onChange={(e) => setGateTokenMint(e.target.value)}
                      placeholder="Token mint address..."
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Minimum Balance Required</label>
                    <input
                      type="number"
                      value={gateTokenAmount}
                      onChange={(e) => setGateTokenAmount(e.target.value)}
                      placeholder="100"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </motion.div>
              )}
              
              {gateType === 'paid' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-sm font-medium mb-2">Price (SOL)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="number"
                      step="0.01"
                      value={priceSOL}
                      onChange={(e) => setPriceSOL(e.target.value)}
                      placeholder="0.50"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Summary */}
            <div className="mt-8 p-6 bg-white/5 rounded-xl">
              <h3 className="font-medium mb-4">Track Summary</h3>
              <div className="flex gap-4">
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="w-20 h-20 rounded-lg object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                    <Music size={32} className="text-gray-600" />
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-lg">{title || 'Untitled'}</h4>
                  <p className="text-gray-400 text-sm">{genre || 'No genre'} • {formatDuration(audioDuration)}</p>
                  <p className="text-cyan-400 text-sm mt-1">{ticker || generateTicker(title || 'TRACK')}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-3 bg-cyan-500 text-black font-medium rounded-xl hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={uploading || !canProceed()}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload Track
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
