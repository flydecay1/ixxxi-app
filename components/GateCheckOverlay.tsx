"use client";

import React from "react";
import { Lock, Unlock, Loader2, AlertTriangle, Wallet } from "lucide-react";
import type { GateStatus } from "@/app/types";

interface GateCheckOverlayProps {
  gateStatus: GateStatus;
  isVisible: boolean;
  onClose?: () => void;
  requiredAmount?: number;
  tokenSymbol?: string;
}

export function GateCheckOverlay({
  gateStatus,
  isVisible,
  onClose,
  requiredAmount = 1,
  tokenSymbol = "TOKEN",
}: GateCheckOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center">
      <div className="border border-green-500/50 bg-black/95 p-8 max-w-md w-full mx-4 font-mono">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 text-green-500 border-b border-green-500/30 pb-4">
          <div className="w-2 h-2 bg-green-500 animate-pulse" />
          <span className="text-xs tracking-widest">GATE_PROTOCOL_v1.0</span>
        </div>

        {/* Checking State */}
        {gateStatus.checking && (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
            <div className="text-lg text-green-400 mb-2">VERIFYING ACCESS</div>
            <div className="text-xs text-green-600 animate-pulse">
              Querying Solana blockchain...
            </div>
            <div className="mt-4 text-[10px] text-green-800 font-mono">
              <div>→ Connecting to RPC node</div>
              <div>→ Scanning token accounts</div>
              <div>→ Validating ownership</div>
            </div>
          </div>
        )}

        {/* Access Granted */}
        {!gateStatus.checking && gateStatus.hasAccess && (
          <div className="text-center">
            <div className="w-16 h-16 border-2 border-green-500 mx-auto mb-4 flex items-center justify-center">
              <Unlock className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-lg text-green-400 mb-2">ACCESS GRANTED</div>
            <div className="text-xs text-green-600 mb-4">
              Token verification successful
            </div>
            {gateStatus.balance !== undefined && (
              <div className="bg-green-900/20 border border-green-500/30 p-3 text-sm">
                <span className="text-green-600">BALANCE:</span>{" "}
                <span className="text-green-400">{gateStatus.balance} {tokenSymbol}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 border border-green-500 text-green-500 hover:bg-green-500 hover:text-black transition-all text-sm"
            >
              PROCEED →
            </button>
          </div>
        )}

        {/* Access Denied */}
        {!gateStatus.checking && !gateStatus.hasAccess && (
          <div className="text-center">
            <div className="w-16 h-16 border-2 border-red-500 mx-auto mb-4 flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-lg text-red-400 mb-2">ACCESS DENIED</div>
            <div className="text-xs text-red-600 mb-4">
              {gateStatus.error || "Insufficient token balance"}
            </div>
            
            <div className="bg-red-900/20 border border-red-500/30 p-4 text-left text-sm mb-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertTriangle size={14} />
                <span>REQUIREMENTS NOT MET</span>
              </div>
              <div className="text-xs text-red-600 space-y-1">
                <div>• Required: {requiredAmount} {tokenSymbol}</div>
                <div>• Your balance: {gateStatus.balance || 0} {tokenSymbol}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-400 hover:border-gray-400 transition-all text-sm"
              >
                CANCEL
              </button>
              <a
                href="https://jup.ag"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 border border-green-500 text-green-500 hover:bg-green-500 hover:text-black transition-all text-sm flex items-center justify-center gap-2"
              >
                <Wallet size={14} />
                GET TOKENS
              </a>
            </div>
          </div>
        )}

        {/* Terminal-style footer */}
        <div className="mt-6 pt-4 border-t border-green-500/20 text-[10px] text-green-800">
          <div>PROTOCOL: SPL_TOKEN_GATE</div>
          <div>NETWORK: SOLANA_DEVNET</div>
          <div>STATUS: {gateStatus.checking ? "PROCESSING" : gateStatus.hasAccess ? "VERIFIED" : "REJECTED"}</div>
        </div>
      </div>
    </div>
  );
}

// Compact inline gate badge for track cards
interface GateBadgeProps {
  isPremium?: boolean;
  hasAccess?: boolean;
  checking?: boolean;
  onClick?: () => void;
}

export function GateBadge({ isPremium, hasAccess, checking, onClick }: GateBadgeProps) {
  if (!isPremium) return null;

  return (
    <button
      onClick={onClick}
      className={`
        absolute top-0 right-0 p-1.5 
        ${checking ? 'bg-yellow-500/20' : hasAccess ? 'bg-green-500/20' : 'bg-red-500/20'}
        backdrop-blur-sm transition-all hover:scale-110
      `}
    >
      {checking ? (
        <Loader2 size={12} className="text-yellow-500 animate-spin" />
      ) : hasAccess ? (
        <Unlock size={12} className="text-green-500" />
      ) : (
        <Lock size={12} className="text-red-500" />
      )}
    </button>
  );
}
