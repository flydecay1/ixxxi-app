// app/components/GridBackground.tsx
'use client';

import React from 'react';

interface GridBackgroundProps {
  gridColor?: string; // RGB or RGBA e.g., "0, 255, 100" or "0, 255, 100, 0.4"
  gridSize?: number; // Size of grid squares in px
  animationSpeed?: number; // Duration in seconds
  opacity?: number; // Opacity 0-100
  perspective?: number; // 3D perspective depth
  rotationX?: number; // X-axis rotation in degrees
}

export default function GridBackground({
  gridColor = '0, 255, 100',
  gridSize = 40,
  animationSpeed = 20,
  opacity = 20,
  perspective = 500,
  rotationX = 60,
}: GridBackgroundProps) {
  // Ensure gridColor has alpha if not provided
  const colorValue = gridColor.includes(',') 
    ? gridColor.includes('0.') 
      ? gridColor 
      : `${gridColor}, 0.4`
    : gridColor;

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-black pointer-events-none">
      {/* Fade gradient overlay for depth */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />

      {/* 3D Grid Container */}
      <div
        className="absolute inset-0"
        style={{
          perspective: `${perspective}px`,
          opacity: opacity / 100,
        }}
      >
        {/* Animated Grid Pattern */}
        <div
          className="absolute inset-0 w-[200%] h-[200%] -ml-[50%]"
          style={{
            transform: `rotateX(${rotationX}deg) translateY(-100px) translateZ(-200px)`,
            backgroundImage: `
              linear-gradient(rgba(${colorValue}) 1px, transparent 1px),
              linear-gradient(90deg, rgba(${colorValue}) 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            animation: `gridMove ${animationSpeed}s linear infinite`,
            willChange: 'background-position',
          }}
        />
      </div>

      {/* Animation Keyframes */}
      <style jsx>{`
        @keyframes gridMove {
          0% { background-position: 0 0; }
          100% { background-position: 0 ${gridSize}px; }
        }
      `}</style>
    </div>
  );
}