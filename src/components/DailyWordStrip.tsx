"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Volume2, ArrowRight } from "lucide-react";
import type { VocabularyWordData } from "@/app/actions/vocabulary";
import { HINDI_DICTIONARY } from "@/lib/vocabulary-words";

function getISTDateString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function DailyWordStrip() {
  const [randomWord, setRandomWord] = useState<VocabularyWordData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTodayWord() {
      const todayDate = getISTDateString();
      const cacheKey = `todo_vocab_daily_${todayDate}`;

      // 1. Check LocalStorage first for instant 0ms rendering
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && Array.isArray(parsed.words) && parsed.words.length > 0) {
              const randomIndex = Math.floor(Math.random() * parsed.words.length);
              setRandomWord(parsed.words[randomIndex]);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Ignore
        }
      }

      // 2. Fetch from DB/Server if not in LocalStorage
      try {
        const res = await fetch(`/api/vocabulary?date=${todayDate}`);
        const data = res.ok ? (await res.json() as { words: VocabularyWordData[] }) : null;
        if (data && data.words.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.words.length);
          setRandomWord(data.words[randomIndex]);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(data));
            } catch {
              // Ignore
            }
          }
        }
      } catch (err) {
        console.error("Failed to load daily word strip:", err);
      } finally {
        setLoading(false);
      }
    }
    void loadTodayWord();
  }, []);

  const speakWord = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!randomWord || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(randomWord.word);
    utterance.lang = "en-IN";
    utterance.rate = 0.85;

    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(
      (v) =>
        v.lang === "en-IN" ||
        v.lang.replace("-", "_") === "en_IN" ||
        v.name.toLowerCase().includes("india") ||
        v.name.toLowerCase().includes("hindi")
    );

    if (indianVoice) utterance.voice = indianVoice;
    window.speechSynthesis.speak(utterance);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-3.5 sm:p-4 shadow-2xs flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-muted" />
          <div className="space-y-1">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-5 w-32 bg-muted rounded" />
          </div>
        </div>
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  if (!randomWord) return null;

  const hindiText =
    randomWord.hindiMeaning ||
    HINDI_DICTIONARY[randomWord.word.toLowerCase()] ||
    "";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs flex items-center justify-between gap-3">
      {/* LEFT REGION: TAP TO PLAY SOUND */}
      <div
        onClick={speakWord}
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group/left"
        title="Tap to listen pronunciation"
      >
        <div className="size-10 sm:size-11 shrink-0 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/25 group-hover/left:bg-emerald-500/25 transition-colors">
          <Sparkles className="size-5 sm:size-6 text-emerald-600" />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider block leading-none">
            Today&apos;s Word
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-xl font-extrabold text-foreground capitalize truncate">
              {randomWord.word}
            </h3>
            {hindiText && (
              <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {hindiText}
              </span>
            )}
            <button
              type="button"
              onClick={speakWord}
              className="p-1.5 sm:p-2 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 transition-colors cursor-pointer shrink-0 border border-emerald-500/20"
              title="Listen pronunciation"
            >
              <Volume2 className="size-4 sm:size-5 text-emerald-600 stroke-[2.5]" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground truncate font-medium max-w-[200px] sm:max-w-xs">
            {randomWord.englishMeaning || "To give a detailed account in words."}
          </p>
        </div>
      </div>

      {/* RIGHT REGION: NAVIGATE TO VOCABULARY PAGE */}
      <Link
        href="/vocabulary"
        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-emerald-600 shrink-0 transition-colors pl-2 border-l border-border/60 py-2 group/right cursor-pointer"
      >
        <span className="hidden sm:inline">Tap to see more</span>
        <ArrowRight className="size-4 group-hover/right:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}
