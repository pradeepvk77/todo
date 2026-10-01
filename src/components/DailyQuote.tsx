"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { TimeOfDay } from "@/lib/time-utils";

type QuoteItem = { text: string; author: string };
type StoredQuotes = { date: string; quotes: QuoteItem[] };

const storageKey = "todo.daily-zenquotes";
const fallbackQuote: QuoteItem = {
  text: "Small steps every day lead to big results.",
  author: "Unknown",
};
const emptySubscribe = () => () => {};

// WebP images are already in /public — they are 10–14× smaller than the PNGs.
// Using standard <img> elements (rather than CSS background-image) lets the
// browser's preload scanner discover the LCP image in the HTML stream instead
// of waiting until React hydrates the component.
//
// Phase 2 fix: the server now passes `initialTimeOfDay` so the *initial* HTML
// always contains the correct image URL. The preload scanner can find it at
// HTML parse time, eliminating the 4.1 s resource-load-delay from the LCP audit.
const timeOfDayStyles = {
  morning:  { image: "/morning.webp",   overlay: "bg-white/50 backdrop-blur-xs",       text: "text-slate-950", authorText: "text-slate-700 font-medium" },
  afternoon:{ image: "/afternoon.webp", overlay: "bg-white/50 backdrop-blur-xs",       text: "text-slate-950", authorText: "text-slate-700 font-medium" },
  evening:  { image: "/evening.webp",   overlay: "bg-slate-950/50 backdrop-blur-xs",   text: "text-white",     authorText: "text-white/90 font-medium" },
  night:    { image: "/night.webp",     overlay: "bg-slate-950/60 backdrop-blur-xs",   text: "text-white",     authorText: "text-white/90 font-medium" },
} satisfies Record<TimeOfDay, { image: string; overlay: string; text: string; authorText: string }>;

function getClientTimeOfDay(): TimeOfDay {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date())
  );
  if (hour < 5 || hour >= 20) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getISTDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function randomQuote(quotes: QuoteItem[]) {
  return quotes[Math.floor(Math.random() * quotes.length)] ?? fallbackQuote;
}

function readStoredQuotes() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null") as StoredQuotes | null;
    if (stored?.date === getISTDate() && Array.isArray(stored.quotes) && stored.quotes.length) return stored.quotes;
  } catch {
    // A malformed cache should not prevent the dashboard from rendering.
  }
  return null;
}

interface DailyQuoteProps {
  /**
   * Server-computed IST time-of-day bucket. Passed from the server component so the
   * initial HTML contains the correct hero image URL — making it discoverable by the
   * browser's preload scanner and fixing the 4.1 s LCP resource-load-delay.
   */
  initialTimeOfDay?: TimeOfDay;
}

export function DailyQuote({ initialTimeOfDay = "morning" }: DailyQuoteProps) {
  const [quote, setQuote] = useState<QuoteItem>(fallbackQuote);

  // Use server value as the SSR snapshot so the initial HTML matches the real image.
  // After hydration, switch to the live client value (in case time bucket changed).
  const timeOfDay = useSyncExternalStore<TimeOfDay>(
    emptySubscribe,
    getClientTimeOfDay,
    () => initialTimeOfDay ?? "morning"   // ← SSR snapshot = server value, safe fallback
  );
  const background = timeOfDayStyles[timeOfDay] ?? timeOfDayStyles.morning;

  useEffect(() => {
    const loadQuotes = async () => {
      await Promise.resolve();
      const cachedQuotes = readStoredQuotes();
      if (cachedQuotes) {
        setQuote(randomQuote(cachedQuotes));
        return;
      }

      try {
        const response = await fetch("/api/quotes");
        const payload = (await response.json()) as { quotes?: QuoteItem[] };
        if (!response.ok || !Array.isArray(payload.quotes) || !payload.quotes.length) throw new Error("Invalid quote response");

        const dailyQuotes = payload.quotes.slice(0, 50);
        localStorage.setItem(storageKey, JSON.stringify({ date: getISTDate(), quotes: dailyQuotes }));
        setQuote(randomQuote(dailyQuotes));
      } catch {
        setQuote(fallbackQuote);
      }
    };

    void loadQuotes();
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-r from-orange-100/60 via-amber-50/80 to-amber-100/40 dark:from-amber-950/30 dark:to-orange-950/20 shadow-2xs"
      aria-label="Daily quote"
    >
      {/*
        Background image: rendered as a standard <img> (not CSS background-image) so the
        browser's HTML preload scanner can discover and begin fetching it as soon as the
        HTML bytes arrive — before React hydrates. The server passes `initialTimeOfDay`
        so the SSR snapshot is the correct time bucket, not always "morning".
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={background.image}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        width={836}
        height={157}
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Overlay */}
      <div className={`absolute inset-0 ${background.overlay}`} />

      {/* Content */}
      <div className="relative p-4 sm:p-4.5 flex items-start gap-3">
        <span className="text-xl sm:text-2xl font-serif text-amber-700 dark:text-amber-400 shrink-0 leading-none mt-0.5">
          "
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-sm sm:text-base font-semibold italic text-slate-900 dark:text-slate-100 leading-snug">
            "{quote.text}"
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            — {quote.author}
          </p>
        </div>
      </div>
    </section>
  );
}
