"use client";

import React, { useState, useEffect } from "react";

interface LiveClockProps {
  className?: string;
  showDate?: boolean;
  showTimezone?: boolean;
  format24h?: boolean;
}

export default function LiveClock({ 
  className = "", 
  showDate = true, 
  showTimezone = true,
  format24h = true 
}: LiveClockProps) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  const formatTime = () => {
    if (format24h) {
      return time.toLocaleTimeString("en-US", { 
        hour12: false, 
        hour: "2-digit", 
        minute: "2-digit", 
        second: "2-digit" 
      });
    }
    return time.toLocaleTimeString("en-US", { 
      hour12: true, 
      hour: "numeric", 
      minute: "2-digit" 
    });
  };

  const formatDate = () => {
    return time.toLocaleDateString("en-US", { 
      weekday: "short", 
      month: "short", 
      day: "numeric",
      year: "numeric"
    });
  };

  const getTimezone = () => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace("_", " ") || "UTC";
  };

  return (
    <div className={`font-mono ${className}`}>
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tracking-wider text-green-400">
          {formatTime()}
        </span>
        {showTimezone && (
          <span className="text-xs text-gray-500 uppercase">
            {getTimezone()}
          </span>
        )}
      </div>
      {showDate && (
        <div className="text-xs text-gray-500 uppercase tracking-wide">
          {formatDate()}
        </div>
      )}
    </div>
  );
}

// Compact version for headers
export function CompactClock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  return (
    <span className={`font-mono text-sm text-green-400 ${className}`}>
      {time.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

// World clock showing multiple timezones
export function WorldClock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState<Date | null>(null);

  const ZONES = [
    { city: "NYC", tz: "America/New_York" },
    { city: "LON", tz: "Europe/London" },
    { city: "TYO", tz: "Asia/Tokyo" },
    { city: "SYD", tz: "Australia/Sydney" },
  ];

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  return (
    <div className={`flex gap-4 font-mono text-xs ${className}`}>
      {ZONES.map(({ city, tz }) => (
        <div key={city} className="text-center">
          <div className="text-gray-500">{city}</div>
          <div className="text-green-400">
            {time.toLocaleTimeString("en-US", { 
              timeZone: tz, 
              hour12: false, 
              hour: "2-digit", 
              minute: "2-digit" 
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
