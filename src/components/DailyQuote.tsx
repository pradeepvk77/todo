"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Quote } from "lucide-react";

type QuoteItem = { text: string; author: string };
type StoredQuotes = { date: string; quotes: QuoteItem[] };

const storageKey = "todo.daily-zenquotes";
const fallbackQuote: QuoteItem = {
  text: "Small steps every day lead to big results.",
  author: "Unknown",
};
const emptySubscribe = () => () => {};

const timeOfDayStyles = {
  morning: { image: "/morning.png", overlay: "bg-white/20", text: "text-slate-950", mutedText: "text-slate-700" },
  afternoon: { image: "/afternoon.png", overlay: "bg-white/20", text: "text-slate-950", mutedText: "text-slate-700" },
  evening: { image: "/evening.png", overlay: "bg-slate-950/20", text: "text-white", mutedText: "text-white/85" },
  night: { image: "/night.png", overlay: "bg-slate-950/35", text: "text-white", mutedText: "text-white/85" },
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
      // Defer cache hydration so the server fallback and first client render match.
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
    <section className="relative overflow-hidden rounded-2xl border border-border p-5 shadow-xs sm:px-7" style={{ backgroundImage: `url(${background.image})`, backgroundPosition: "center", backgroundSize: "cover" }}>
      <div className={`absolute inset-0 ${background.overlay}`} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-orange-600 shadow-xs"><Quote className="size-4" /></div>
          <div className="min-w-0">
            <p className={`font-serif text-base font-semibold italic leading-snug ${background.text} sm:text-lg`}>“{quote.text}&quot; <span className={`mt-1 text-xs ${background.mutedText}`}>— {quote.author}</span></p>
          </div>
        </div>
      </div>
    </section>
  );
}
