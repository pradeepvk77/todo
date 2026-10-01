"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Registers the Service Worker, manages safe update prompts without interrupting
 * active users, and guarantees that first installs do not reload the page.
 *
 * Also listens for SW_BACKGROUND_UPDATED messages from the service worker so
 * router.refresh() is called after the SW serves stale HTML from cache —
 * ensuring live server data is loaded shortly after the instant shell render.
 */
export function ServiceWorkerRegistrar() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  // Debounce: only call router.refresh() once even if multiple SW_BACKGROUND_UPDATED
  // messages arrive in quick succession (e.g. two open tabs).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Track whether a service worker was controlling the page BEFORE registration
    const hadController = Boolean(navigator.serviceWorker.controller);

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        // Check if an updated worker is already waiting
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdatePrompt(true);
        }

        // Listen for new worker versions found during runtime
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(installingWorker);
              setShowUpdatePrompt(true);
            }
          });
        });
      } catch (err) {
        console.warn("[SW] Registration error:", err);
      }
    };

    // Register after page load / idle to avoid competing for critical startup bandwidth
    if (document.readyState === "complete") {
      void registerWorker();
    } else {
      window.addEventListener("load", () => void registerWorker(), { once: true });
    }

    // Handle SW → client messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_BACKGROUND_UPDATED") {
        // SW served stale HTML from cache; fresh HTML is now in cache.
        // Call router.refresh() to re-fetch server components with live data.
        // Debounce to 300ms in case of multiple tabs.
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => {
          startTransition(() => {
            router.refresh();
          });
        }, 300);
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);

    // Only reload on controller change if the page was ALREADY controlled.
    // If it was the first installation, do NOT reload!
    let reloading = false;
    const handleControllerChange = () => {
      if (hadController && !reloading) {
        reloading = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [router, startTransition]);


  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdatePrompt(false);
    }
  };

  if (!showUpdatePrompt) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300"
    >
      <div className="min-w-0">
        <p className="text-xs font-bold text-foreground">Update Available</p>
        <p className="text-[11px] text-muted-foreground truncate">
          A new version of Lets Do It is ready.
        </p>
      </div>
      <button
        type="button"
        onClick={handleUpdate}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
      >
        <RefreshCw className="size-3" />
        <span>Update</span>
      </button>
    </div>
  );
}
