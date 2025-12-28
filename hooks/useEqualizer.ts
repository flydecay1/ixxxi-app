// hooks/useEqualizer.ts
// Audio equalizer with presets

import { useState, useEffect, useCallback, useRef } from 'react';

interface EqualizerBand {
  frequency: number; // Hz
  gain: number;      // dB (-12 to +12)
  Q?: number;        // Quality factor
}

interface EqualizerPreset {
  id: string;
  name: string;
  icon?: string;
  bands: EqualizerBand[];
}

// Standard 10-band EQ frequencies
const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// Built-in presets
const PRESETS: EqualizerPreset[] = [
  {
    id: 'flat',
    name: 'Flat',
    icon: '🎚️',
    bands: EQ_FREQUENCIES.map(f => ({ frequency: f, gain: 0 })),
  },
  {
    id: 'bass_boost',
    name: 'Bass Boost',
    icon: '🔊',
    bands: [
      { frequency: 32, gain: 8 },
      { frequency: 64, gain: 7 },
      { frequency: 125, gain: 5 },
      { frequency: 250, gain: 3 },
      { frequency: 500, gain: 1 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 0 },
      { frequency: 4000, gain: 0 },
      { frequency: 8000, gain: 0 },
      { frequency: 16000, gain: 0 },
    ],
  },
  {
    id: 'treble_boost',
    name: 'Treble Boost',
    icon: '✨',
    bands: [
      { frequency: 32, gain: 0 },
      { frequency: 64, gain: 0 },
      { frequency: 125, gain: 0 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: 0 },
      { frequency: 1000, gain: 1 },
      { frequency: 2000, gain: 3 },
      { frequency: 4000, gain: 5 },
      { frequency: 8000, gain: 7 },
      { frequency: 16000, gain: 8 },
    ],
  },
  {
    id: 'vocal',
    name: 'Vocal',
    icon: '🎤',
    bands: [
      { frequency: 32, gain: -3 },
      { frequency: 64, gain: -2 },
      { frequency: 125, gain: 0 },
      { frequency: 250, gain: 2 },
      { frequency: 500, gain: 4 },
      { frequency: 1000, gain: 5 },
      { frequency: 2000, gain: 4 },
      { frequency: 4000, gain: 2 },
      { frequency: 8000, gain: 0 },
      { frequency: 16000, gain: -1 },
    ],
  },
  {
    id: 'electronic',
    name: 'Electronic',
    icon: '⚡',
    bands: [
      { frequency: 32, gain: 6 },
      { frequency: 64, gain: 5 },
      { frequency: 125, gain: 2 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: -2 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 2 },
      { frequency: 4000, gain: 4 },
      { frequency: 8000, gain: 5 },
      { frequency: 16000, gain: 6 },
    ],
  },
  {
    id: 'hiphop',
    name: 'Hip-Hop',
    icon: '🎧',
    bands: [
      { frequency: 32, gain: 7 },
      { frequency: 64, gain: 6 },
      { frequency: 125, gain: 3 },
      { frequency: 250, gain: 1 },
      { frequency: 500, gain: -1 },
      { frequency: 1000, gain: -1 },
      { frequency: 2000, gain: 2 },
      { frequency: 4000, gain: 3 },
      { frequency: 8000, gain: 3 },
      { frequency: 16000, gain: 2 },
    ],
  },
  {
    id: 'rock',
    name: 'Rock',
    icon: '🎸',
    bands: [
      { frequency: 32, gain: 5 },
      { frequency: 64, gain: 4 },
      { frequency: 125, gain: 2 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: -1 },
      { frequency: 1000, gain: 1 },
      { frequency: 2000, gain: 3 },
      { frequency: 4000, gain: 4 },
      { frequency: 8000, gain: 4 },
      { frequency: 16000, gain: 3 },
    ],
  },
  {
    id: 'jazz',
    name: 'Jazz',
    icon: '🎷',
    bands: [
      { frequency: 32, gain: 2 },
      { frequency: 64, gain: 3 },
      { frequency: 125, gain: 2 },
      { frequency: 250, gain: 1 },
      { frequency: 500, gain: -1 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 1 },
      { frequency: 4000, gain: 2 },
      { frequency: 8000, gain: 3 },
      { frequency: 16000, gain: 3 },
    ],
  },
  {
    id: 'classical',
    name: 'Classical',
    icon: '🎻',
    bands: [
      { frequency: 32, gain: 0 },
      { frequency: 64, gain: 1 },
      { frequency: 125, gain: 1 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 2000, gain: 1 },
      { frequency: 4000, gain: 2 },
      { frequency: 8000, gain: 2 },
      { frequency: 16000, gain: 1 },
    ],
  },
  {
    id: 'acoustic',
    name: 'Acoustic',
    icon: '🪕',
    bands: [
      { frequency: 32, gain: 2 },
      { frequency: 64, gain: 3 },
      { frequency: 125, gain: 2 },
      { frequency: 250, gain: 1 },
      { frequency: 500, gain: 2 },
      { frequency: 1000, gain: 3 },
      { frequency: 2000, gain: 2 },
      { frequency: 4000, gain: 2 },
      { frequency: 8000, gain: 2 },
      { frequency: 16000, gain: 1 },
    ],
  },
  {
    id: 'loudness',
    name: 'Loudness',
    icon: '📢',
    bands: [
      { frequency: 32, gain: 6 },
      { frequency: 64, gain: 5 },
      { frequency: 125, gain: 2 },
      { frequency: 250, gain: 0 },
      { frequency: 500, gain: -2 },
      { frequency: 1000, gain: -2 },
      { frequency: 2000, gain: -1 },
      { frequency: 4000, gain: 1 },
      { frequency: 8000, gain: 4 },
      { frequency: 16000, gain: 6 },
    ],
  },
  {
    id: 'late_night',
    name: 'Late Night',
    icon: '🌙',
    bands: [
      { frequency: 32, gain: -4 },
      { frequency: 64, gain: -2 },
      { frequency: 125, gain: 0 },
      { frequency: 250, gain: 1 },
      { frequency: 500, gain: 2 },
      { frequency: 1000, gain: 2 },
      { frequency: 2000, gain: 1 },
      { frequency: 4000, gain: 0 },
      { frequency: 8000, gain: -2 },
      { frequency: 16000, gain: -4 },
    ],
  },
];

export function useEqualizer(audioContext: AudioContext | null, sourceNode: AudioNode | null) {
  const [enabled, setEnabled] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string>('flat');
  const [customBands, setCustomBands] = useState<EqualizerBand[]>(
    PRESETS.find(p => p.id === 'flat')!.bands
  );
  const [userPresets, setUserPresets] = useState<EqualizerPreset[]>([]);
  
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Load saved settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedEnabled = localStorage.getItem('eq_enabled');
    const savedPreset = localStorage.getItem('eq_preset');
    const savedCustom = localStorage.getItem('eq_custom');
    const savedUserPresets = localStorage.getItem('eq_user_presets');
    
    if (savedEnabled) setEnabled(savedEnabled === 'true');
    if (savedPreset) setCurrentPreset(savedPreset);
    if (savedCustom) {
      try {
        setCustomBands(JSON.parse(savedCustom));
      } catch {}
    }
    if (savedUserPresets) {
      try {
        setUserPresets(JSON.parse(savedUserPresets));
      } catch {}
    }
  }, []);

  // Save settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('eq_enabled', String(enabled));
    localStorage.setItem('eq_preset', currentPreset);
    localStorage.setItem('eq_custom', JSON.stringify(customBands));
  }, [enabled, currentPreset, customBands]);

  // Save user presets
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('eq_user_presets', JSON.stringify(userPresets));
  }, [userPresets]);

  // Create/update EQ filter chain
  useEffect(() => {
    if (!audioContext || !sourceNode) return;

    // Clean up existing filters
    filtersRef.current.forEach(filter => filter.disconnect());
    filtersRef.current = [];
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
    }

    if (!enabled) {
      // Bypass - connect source directly to destination
      sourceNode.connect(audioContext.destination);
      return;
    }

    // Create filters for each band
    const filters: BiquadFilterNode[] = customBands.map((band, index) => {
      const filter = audioContext.createBiquadFilter();
      
      // First band is low shelf, last is high shelf, others are peaking
      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === customBands.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = band.Q || 1.4;
      }
      
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      
      return filter;
    });

    // Create master gain node
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;
    gainNodeRef.current = gainNode;

    // Chain: source -> filter1 -> filter2 -> ... -> gain -> destination
    sourceNode.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filters[filters.length - 1].connect(gainNode);
    gainNode.connect(audioContext.destination);

    filtersRef.current = filters;

    return () => {
      filters.forEach(filter => filter.disconnect());
      gainNode.disconnect();
    };
  }, [audioContext, sourceNode, enabled, customBands]);

  // Apply preset
  const applyPreset = useCallback((presetId: string) => {
    const preset = [...PRESETS, ...userPresets].find(p => p.id === presetId);
    if (preset) {
      setCustomBands(preset.bands);
      setCurrentPreset(presetId);
    }
  }, [userPresets]);

  // Set individual band gain
  const setBandGain = useCallback((frequency: number, gain: number) => {
    setCustomBands(prev => 
      prev.map(band => 
        band.frequency === frequency 
          ? { ...band, gain: Math.max(-12, Math.min(12, gain)) }
          : band
      )
    );
    setCurrentPreset('custom');
  }, []);

  // Reset to flat
  const reset = useCallback(() => {
    applyPreset('flat');
  }, [applyPreset]);

  // Save current as user preset
  const saveAsPreset = useCallback((name: string, icon?: string) => {
    const id = `user_${Date.now()}`;
    const newPreset: EqualizerPreset = {
      id,
      name,
      icon,
      bands: [...customBands],
    };
    setUserPresets(prev => [...prev, newPreset]);
    setCurrentPreset(id);
    return id;
  }, [customBands]);

  // Delete user preset
  const deletePreset = useCallback((presetId: string) => {
    setUserPresets(prev => prev.filter(p => p.id !== presetId));
    if (currentPreset === presetId) {
      applyPreset('flat');
    }
  }, [currentPreset, applyPreset]);

  // Get all available presets
  const allPresets = [...PRESETS, ...userPresets];

  return {
    enabled,
    setEnabled,
    currentPreset,
    bands: customBands,
    presets: allPresets,
    builtInPresets: PRESETS,
    userPresets,
    applyPreset,
    setBandGain,
    reset,
    saveAsPreset,
    deletePreset,
    frequencies: EQ_FREQUENCIES,
  };
}

export { PRESETS as EQ_PRESETS, EQ_FREQUENCIES };
export type { EqualizerBand, EqualizerPreset };
