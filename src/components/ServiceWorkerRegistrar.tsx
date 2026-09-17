"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for ALL users — not just those who enable push
 * notifications. This gives everyone caching, offline support, and background sync.
 *
 * Mounted once in RootLayout so it runs on every page.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Register SW — safe to call repeatedly; browser deduplicates
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[SW] Registration failed:", err));

    // When the SW sends BACKGROUND_SYNC (device came back online),
    // reload the page so the user sees fresh data immediately.
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "BACKGROUND_SYNC") {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
