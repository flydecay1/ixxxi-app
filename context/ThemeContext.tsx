"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "neon" | "sunset" | "ocean";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  error: string;
  globe: {
    ocean: string;
    land: string;
    grid: string;
    glow: string;
  };
}

const THEMES: Record<ThemeMode, ThemeColors> = {
  dark: {
    primary: "#22c55e",
    secondary: "#10b981",
    accent: "#34d399",
    background: "#000000",
    surface: "#111111",
    text: "#ffffff",
    textMuted: "#888888",
    border: "#333333",
    success: "#22c55e",
    error: "#ef4444",
    globe: {
      ocean: "#0a1628",
      land: "#22c55e",
      grid: "#22c55e",
      glow: "#22c55e",
    },
  },
  light: {
    primary: "#059669",
    secondary: "#10b981",
    accent: "#34d399",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    success: "#22c55e",
    error: "#ef4444",
    globe: {
      ocean: "#e0f2fe",
      land: "#059669",
      grid: "#0369a1",
      glow: "#06b6d4",
    },
  },
  neon: {
    primary: "#f0abfc",
    secondary: "#c084fc",
    accent: "#e879f9",
    background: "#0c0015",
    surface: "#1a0029",
    text: "#fdf4ff",
    textMuted: "#a855f7",
    border: "#581c87",
    success: "#22c55e",
    error: "#f43f5e",
    globe: {
      ocean: "#0c0015",
      land: "#f0abfc",
      grid: "#c084fc",
      glow: "#e879f9",
    },
  },
  sunset: {
    primary: "#f97316",
    secondary: "#fb923c",
    accent: "#fbbf24",
    background: "#1c1917",
    surface: "#292524",
    text: "#fef3c7",
    textMuted: "#a8a29e",
    border: "#44403c",
    success: "#84cc16",
    error: "#ef4444",
    globe: {
      ocean: "#1c1917",
      land: "#f97316",
      grid: "#fbbf24",
      glow: "#fb923c",
    },
  },
  ocean: {
    primary: "#06b6d4",
    secondary: "#0891b2",
    accent: "#22d3ee",
    background: "#0c1929",
    surface: "#0f2942",
    text: "#ecfeff",
    textMuted: "#67e8f9",
    border: "#164e63",
    success: "#22c55e",
    error: "#f43f5e",
    globe: {
      ocean: "#0c1929",
      land: "#06b6d4",
      grid: "#0ea5e9",
      glow: "#22d3ee",
    },
  },
};

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  setTheme: (theme: ThemeMode) => void;
  themes: ThemeMode[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("ixxxi-theme") as ThemeMode;
    if (saved && THEMES[saved]) {
      setThemeState(saved);
    }
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem("ixxxi-theme", newTheme);
    
    // Apply CSS variables
    const colors = THEMES[newTheme];
    document.documentElement.style.setProperty("--color-primary", colors.primary);
    document.documentElement.style.setProperty("--color-secondary", colors.secondary);
    document.documentElement.style.setProperty("--color-background", colors.background);
    document.documentElement.style.setProperty("--color-surface", colors.surface);
    document.documentElement.style.setProperty("--color-text", colors.text);
    document.documentElement.style.setProperty("--color-text-muted", colors.textMuted);
    document.documentElement.style.setProperty("--color-border", colors.border);
  };

  useEffect(() => {
    // Apply theme on mount
    setTheme(theme);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors: THEMES[theme],
        setTheme,
        themes: Object.keys(THEMES) as ThemeMode[],
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
