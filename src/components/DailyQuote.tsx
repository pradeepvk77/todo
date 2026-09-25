"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
const timeOfDayStyles = {
  morning:  { image: "/morning.webp",   overlay: "bg-white/50 backdrop-blur-xs",       text: "text-slate-950", authorText: "text-slate-700 font-medium" },
  afternoon:{ image: "/afternoon.webp", overlay: "bg-white/50 backdrop-blur-xs",       text: "text-slate-950", authorText: "text-slate-700 font-medium" },
  evening:  { image: "/evening.webp",   overlay: "bg-slate-950/50 backdrop-blur-xs",   text: "text-white",     authorText: "text-white/90 font-medium" },
  night:    { image: "/night.webp",     overlay: "bg-slate-950/60 backdrop-blur-xs",   text: "text-white",     authorText: "text-white/90 font-medium" },
};

type TimeOfDay = keyof typeof timeOfDayStyles;

function getTimeOfDay(): TimeOfDay {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  if (hour < 5 || hour >= 20) return "night";
  if (hour >= 5 && hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 20) return "evening";
  return "night";
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

export function DailyQuote() {
  const [quote, setQuote] = useState<QuoteItem>(fallbackQuote);
  const timeOfDay = useSyncExternalStore<TimeOfDay>(emptySubscribe, getTimeOfDay, () => "morning");
  const background = timeOfDayStyles[timeOfDay];

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
        Background image rendered as a standard <img> element instead of CSS background-image.
        This lets the browser's HTML preload scanner discover and fetch the image immediately
        from the server-rendered HTML, without waiting for React hydration.
        - WebP images are 10–14× smaller than the original PNGs (9.7 KiB vs 173 KiB).
        - fetchPriority="high" signals this is the likely LCP element.
        - aria-hidden prevents screen readers from announcing a decorative image.
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
