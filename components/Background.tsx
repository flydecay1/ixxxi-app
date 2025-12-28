"use client";
import React from "react";

export default function Background() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* 1. GRID */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(34, 197, 94, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)',
          transformOrigin: 'top center'
        }}
      />
      {/* 2. EARTH SPHERE */}
      <div className="absolute top-20 right-[-100px] opacity-30">
        <div className="relative w-[600px] h-[600px] animate-spin-slow">
           {[...Array(8)].map((_, i) => (
             <div key={i} className="absolute inset-0 rounded-full border border-green-500/30" style={{ transform: `rotateY(${i * 22.5}deg)` }} />
           ))}
           <div className="absolute inset-0 rounded-full border border-green-500/30 rotate-90" />
        </div>
      </div>
      {/* Animation */}
      <style jsx>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 60s linear infinite; }
      `}</style>
    </div>
  );
}