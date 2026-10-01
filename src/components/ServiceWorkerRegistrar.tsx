"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Registers the Service Worker, manages safe update prompts without interrupting
 * active users, and guarantees that first installs do not reload the page.
 */
export function ServiceWorkerRegistrar() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

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
    };
  }, []);

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
