"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Volume2, ArrowRight } from "lucide-react";
import { getDailyVocabulary } from "@/app/actions/vocabulary";
import type { VocabularyWordData } from "@/app/actions/vocabulary";

export function DailyWordStrip() {
  const [randomWord, setRandomWord] = useState<VocabularyWordData | null>(null);

  useEffect(() => {
    async function loadTodayWord() {
      try {
        const data = await getDailyVocabulary();
        if (data && data.words.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.words.length);
          setRandomWord(data.words[randomIndex]);
        }
      } catch (err) {
        console.error("Failed to load daily word strip:", err);
      }
    }
    void loadTodayWord();
  }, []);

  const speakWord = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  if (!randomWord) return null;

  return (
    <Link href="/vocabulary" className="block group">
      <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-3 sm:p-3.5 shadow-2xs hover:border-primary/40 transition-all flex items-center justify-between gap-3">
        {/* Left Side: Word + Speaker */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="size-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block leading-none mb-0.5">
              Daily Word
            </span>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm sm:text-base font-bold text-foreground capitalize truncate">
                {randomWord.word}
              </h3>
              <button
                type="button"
                onClick={speakWord}
                className="p-1 rounded-full text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
                title="Listen in Indian English accent"
              >
                <Volume2 className="size-3.5 text-primary" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Hindi Meaning + Arrow */}
        <div className="flex items-center gap-2 text-right shrink-0">
          {randomWord.hindiMeaning && (
            <span className="text-xs sm:text-sm font-bold text-primary max-w-[150px] sm:max-w-[220px] truncate">
              {randomWord.hindiMeaning}
            </span>
          )}
          <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </div>
    </Link>
  );
}
