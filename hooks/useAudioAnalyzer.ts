"use client";

import { useEffect, useRef, useState } from "react";

interface AudioAnalyzerState {
  intensity: number;
  frequencyData: Uint8Array | null;
  bassLevel: number;
  midLevel: number;
  highLevel: number;
}

export function useAudioAnalyzer(audioElement: HTMLAudioElement | null) {
  const [state, setState] = useState<AudioAnalyzerState>({
    intensity: 0,
    frequencyData: null,
    bassLevel: 0,
    midLevel: 0,
    highLevel: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioElement) return;
    
    // Prevent reconnecting to the same element
    if (connectedElementRef.current === audioElement) return;

    const analyze = () => {
      if (!analyzerRef.current) return;

      const analyzer = analyzerRef.current;
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteFrequencyData(dataArray);

      // Calculate frequency bands
      const bassEnd = Math.floor(bufferLength * 0.1); // 0-10% = bass
      const midEnd = Math.floor(bufferLength * 0.5);  // 10-50% = mids
      
      let bassSum = 0, midSum = 0, highSum = 0;
      
      for (let i = 0; i < bassEnd; i++) {
        bassSum += dataArray[i];
      }
      for (let i = bassEnd; i < midEnd; i++) {
        midSum += dataArray[i];
      }
      for (let i = midEnd; i < bufferLength; i++) {
        highSum += dataArray[i];
      }

      const bassLevel = bassSum / (bassEnd * 255);
      const midLevel = midSum / ((midEnd - bassEnd) * 255);
      const highLevel = highSum / ((bufferLength - midEnd) * 255);
      
      // Overall intensity weighted towards bass for visual impact
      const intensity = bassLevel * 0.5 + midLevel * 0.3 + highLevel * 0.2;

      setState({
        intensity,
        frequencyData: dataArray,
        bassLevel,
        midLevel,
        highLevel,
      });

      animationRef.current = requestAnimationFrame(analyze);
    };

    const setupAnalyzer = async () => {
      try {
        // Create or resume audio context
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        
        const audioContext = audioContextRef.current;
        
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        // Create analyzer node
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.8;
        analyzerRef.current = analyzer;

        // Connect audio element to analyzer
        // Only create source if not already connected
        if (!sourceRef.current) {
          const source = audioContext.createMediaElementSource(audioElement);
          source.connect(analyzer);
          analyzer.connect(audioContext.destination);
          sourceRef.current = source;
        }

        connectedElementRef.current = audioElement;
        
        // Start analysis loop
        analyze();
      } catch (error) {
        console.error("Error setting up audio analyzer:", error);
      }
    };

    setupAnalyzer();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioElement]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  return state;
}
