"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { AudioAsset } from "@/app/types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: AudioAsset[];
  onSelectTrack: (track: AudioAsset) => void;
  currentTrack: AudioAsset | null;
}

// Regions for filtering
const REGIONS = [
  { name: "All Regions", filter: null },
  { name: "Asia Pacific", filter: ["TOKYO", "SYDNEY", "TKY", "SYD"] },
  { name: "Europe", filter: ["BERLIN", "LONDON", "BER", "LDN", "EUR"] },
  { name: "Americas", filter: ["NYC", "MIAMI", "LA", "ATL", "USA"] },
];

type CommandType = "track" | "region" | "action";

interface CommandItem {
  type: CommandType;
  id: string;
  label: string;
  sublabel?: string;
  icon: string;
  data?: AudioAsset | string[];
}

export default function CommandPalette({
  isOpen,
  onClose,
  tracks,
  onSelectTrack,
  currentTrack,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeRegion, setActiveRegion] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command list
  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Add region filters
    REGIONS.forEach((region) => {
      items.push({
        type: "region",
        id: `region-${region.name}`,
        label: region.name,
        sublabel: region.filter ? `Filter: ${region.filter.join(", ")}` : "Show all tracks",
        icon: "🌍",
        data: region.filter || undefined,
      });
    });

    // Add actions
    items.push({
      type: "action",
      id: "action-shuffle",
      label: "Shuffle Play",
      sublabel: "Play random track",
      icon: "🎲",
    });

    items.push({
      type: "action",
      id: "action-stop",
      label: "Stop Playback",
      sublabel: "Pause current track",
      icon: "⏹️",
    });

    // Add tracks (filtered by region if active)
    tracks.forEach((track) => {
      // Check if track matches active region
      if (activeRegion) {
        const matchesRegion = activeRegion.some(
          (keyword) =>
            track.ticker.toUpperCase().includes(keyword) ||
            track.coordinates?.toUpperCase().includes(keyword) ||
            track.title.toUpperCase().includes(keyword)
        );
        if (!matchesRegion) return;
      }

      items.push({
        type: "track",
        id: track.id,
        label: track.ticker,
        sublabel: `${track.title} • ${track.artist}`,
        icon: track.isPremium ? "🔒" : "▶️",
        data: track,
      });
    });

    return items;
  }, [tracks, activeRegion]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.sublabel?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedElement = list.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          const selected = filteredCommands[selectedIndex];
          if (selected) {
            handleSelect(selected);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  // Handle selection
  const handleSelect = useCallback(
    (item: CommandItem) => {
      switch (item.type) {
        case "track":
          onSelectTrack(item.data as AudioAsset);
          onClose();
          break;
        case "region":
          setActiveRegion(item.data as string[] | null);
          setQuery("");
          break;
        case "action":
          if (item.id === "action-shuffle") {
            const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
            if (randomTrack) {
              onSelectTrack(randomTrack);
            }
          }
          onClose();
          break;
      }
    },
    [onSelectTrack, onClose, tracks]
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl bg-black/95 border border-green-500/30 rounded-lg shadow-2xl shadow-green-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-green-500/20">
          <span className="text-green-500 mr-3 text-lg">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeRegion
                ? `Search in filtered region...`
                : "Search tracks, regions, or commands..."
            }
            className="flex-1 bg-transparent text-green-400 placeholder-green-600/50 outline-none font-mono text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-green-600 bg-green-500/10 rounded border border-green-500/20">
            ESC
          </kbd>
        </div>

        {/* Active Region Badge */}
        {activeRegion && (
          <div className="px-4 py-2 bg-green-500/10 border-b border-green-500/20 flex items-center justify-between">
            <span className="text-xs text-green-400 font-mono">
              REGION FILTER ACTIVE: {activeRegion.join(", ")}
            </span>
            <button
              onClick={() => setActiveRegion(null)}
              className="text-xs text-green-600 hover:text-green-400 font-mono"
            >
              [CLEAR]
            </button>
          </div>
        )}

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/20"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-green-600/50 font-mono text-sm">
              NO RESULTS FOUND
            </div>
          ) : (
            filteredCommands.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-green-500/20 text-green-400"
                    : "text-green-500/70 hover:bg-green-500/10"
                }`}
              >
                <span className="text-lg w-6 text-center">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-mono text-sm ${
                      item.type === "track" && currentTrack?.id === item.id
                        ? "text-green-300"
                        : ""
                    }`}
                  >
                    {item.label}
                    {item.type === "track" && currentTrack?.id === item.id && (
                      <span className="ml-2 text-xs text-green-500">▶ NOW PLAYING</span>
                    )}
                  </div>
                  {item.sublabel && (
                    <div className="text-xs text-green-600/60 truncate">
                      {item.sublabel}
                    </div>
                  )}
                </div>
                {item.type === "region" && (
                  <span className="text-xs text-green-600/40 font-mono">FILTER</span>
                )}
                {item.type === "action" && (
                  <span className="text-xs text-green-600/40 font-mono">ACTION</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-green-500/20 flex items-center justify-between text-xs text-green-600/50 font-mono">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>{filteredCommands.length} results</span>
        </div>
      </div>
    </div>
  );
}
