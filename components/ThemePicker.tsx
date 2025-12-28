"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Check, Sun, Moon, Sparkles } from "lucide-react";
import { useTheme, ThemeMode } from "@/context/ThemeContext";

const THEME_INFO: Record<ThemeMode, { name: string; icon: React.ElementType; preview: string[] }> = {
  dark: { 
    name: "Terminal Dark", 
    icon: Moon, 
    preview: ["#000000", "#22c55e", "#111111"] 
  },
  light: { 
    name: "Clean Light", 
    icon: Sun, 
    preview: ["#f8fafc", "#059669", "#ffffff"] 
  },
  neon: { 
    name: "Neon Cyber", 
    icon: Sparkles, 
    preview: ["#0c0015", "#f0abfc", "#1a0029"] 
  },
  sunset: { 
    name: "Sunset Vibes", 
    icon: Palette, 
    preview: ["#1c1917", "#f97316", "#292524"] 
  },
  ocean: { 
    name: "Ocean Deep", 
    icon: Palette, 
    preview: ["#0c1929", "#06b6d4", "#0f2942"] 
  },
};

export default function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700 transition-colors"
      >
        <Palette className="w-4 h-4 text-green-400" />
        <span className="text-sm text-gray-300">Theme</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-gray-800">
                <h3 className="text-sm font-bold text-white">Choose Theme</h3>
                <p className="text-xs text-gray-500 mt-1">Customize your IXXXI experience</p>
              </div>
              
              <div className="p-2 space-y-1">
                {themes.map((t) => {
                  const info = THEME_INFO[t];
                  const Icon = info.icon;
                  const isSelected = theme === t;

                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setTheme(t);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        isSelected 
                          ? "bg-green-500/20 border border-green-500/50" 
                          : "hover:bg-gray-800 border border-transparent"
                      }`}
                    >
                      {/* Color preview dots */}
                      <div className="flex gap-1">
                        {info.preview.map((color, i) => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-full border border-gray-600"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      
                      <div className="flex-1 text-left">
                        <span className={`text-sm ${isSelected ? "text-white" : "text-gray-300"}`}>
                          {info.name}
                        </span>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-green-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-3 border-t border-gray-800 bg-gray-900/50">
                <p className="text-xs text-gray-500 text-center">
                  More themes coming soon
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Inline theme toggle for compact spaces
export function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();
  
  const nextTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <button
      onClick={nextTheme}
      className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700 transition-colors"
      title="Switch theme"
    >
      <Palette className="w-4 h-4 text-green-400" />
    </button>
  );
}
