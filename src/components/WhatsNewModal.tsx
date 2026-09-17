"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X, CheckCircle2, Rocket } from "lucide-react";
import { markWhatsNewSeen } from "@/app/actions/release-notes";

interface ReleaseData {
  version: string;
  title: string;
  features: string[];
  release_date: string;
}

export function WhatsNewModal() {
  const [release, setRelease] = useState<ReleaseData | null>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    fetch("/api/whats-new")
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ show: boolean; release: ReleaseData | null }>;
      })
      .then((data) => {
        if (!data || !data.show || !data.release) return;

        // Fast client-side guard — if localStorage already has it, skip showing
        const lsKey = `whats_new_seen_v${data.release.version}`;
        if (localStorage.getItem(lsKey)) return;

        setRelease(data.release);
        setTimeout(() => setVisible(true), 600);
      })
      .catch(() => {});
  }, []);

  const dismiss = async () => {
    if (!release) return;

    // 1. Animate out immediately (don't wait for server)
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setRelease(null);
    }, 300);

    // 2. Fast client-side guard for same device/browser
    localStorage.setItem(`whats_new_seen_v${release.version}`, "1");

    // 3. Persist to DB — prevents re-show on incognito / new device / other browser
    await markWhatsNewSeen(release.version);
  };

  if (!release || !visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          closing ? "opacity-0" : "opacity-100"
        }`}
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Centered modal container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What's New"
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ease-out pointer-events-auto ${
          closing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        <div className="w-full max-w-lg rounded-3xl bg-card border border-border/60 shadow-2xl overflow-hidden">
          {/* Gradient header strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />

          <div className="p-6 space-y-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="size-5 text-violet-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-extrabold text-foreground tracking-tight">
                      {release.title}
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500 border border-violet-500/25 tracking-wide uppercase">
                      {release.version}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Released{" "}
                    {new Date(release.release_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="whats-new-close-btn"
                onClick={dismiss}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex-shrink-0"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Feature list */}
            <ul className="space-y-2.5">
              {release.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground/90 leading-snug">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                id="whats-new-got-it-btn"
                onClick={dismiss}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/25 cursor-pointer"
              >
                <span>Got it 🎉</span>
              </button>
              <Link
                href="/whats-new"
                id="whats-new-view-all-btn"
                onClick={dismiss}
                className="px-4 py-3 rounded-2xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Rocket className="size-3.5" />
                <span>All releases</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
