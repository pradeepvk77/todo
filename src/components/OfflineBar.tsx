"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

/**
 * Shows a slim bar at the top of the screen when the device is offline.
 * When the connection is restored it registers a background sync so the
 * service worker can notify tabs to reload with fresh data.
 */
export function OfflineBar() {
  const [isOnline, setIsOnline] = useState(true);   // optimistic — set correctly on mount
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    // Correct the initial state after hydration
    setIsOnline(navigator.onLine);

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);

      // Register background sync so the SW notifies all tabs to refresh
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            if ("sync" in reg) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (reg as any).sync.register("task-sync");
            }
          })
          .catch(() => {
            // Background sync not supported — fall back to simple reload
            window.location.reload();
          });
      }

      // Hide the "reconnected" banner after 3 s
      setTimeout(() => setJustReconnected(false), 3000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Nothing to show when fully online
  if (isOnline && !justReconnected) return null;

  // ── Back online banner ─────────────────────────────────────────────────────
  if (justReconnected) {
    return (
      <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 shadow-lg animate-in slide-in-from-top duration-300">
        <Wifi className="size-3.5 shrink-0" />
        <span>Back online — refreshing…</span>
      </div>
    );
  }

  // ── Offline bar ────────────────────────────────────────────────────────────
  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-between gap-3 bg-zinc-900 text-white text-xs font-bold px-4 py-2.5 shadow-lg animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="size-3.5 shrink-0" />
        <span className="truncate">You&apos;re offline. Changes won&apos;t save until reconnected.</span>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0 cursor-pointer"
      >
        <RefreshCw className="size-3" />
        <span>Retry</span>
      </button>
    </div>
  );
}
