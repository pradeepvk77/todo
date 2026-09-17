"use client";

import { Badge } from "@/components/ui/badge";
import { Volume2 } from "lucide-react";
import { VocabularyWordData } from "@/app/actions/vocabulary";

interface WordCardProps {
  word: VocabularyWordData;
  index: number;
}

export function WordCard({ word, index }: WordCardProps) {
  const speakWord = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.word);
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

    if (indianVoice) {
      utterance.voice = indianVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
      {/* ── Word title, single sound button, and part of speech ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground tabular-nums select-none shrink-0">
          {index + 1}.
        </span>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground capitalize">
          {word.word}
        </h2>
        <button
          type="button"
          onClick={speakWord}
          className="p-2 sm:p-2.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors cursor-pointer border border-emerald-500/20 shrink-0 shadow-2xs"
          title="Listen to Indian English pronunciation"
        >
          <Volume2 className="size-5 sm:size-6 text-emerald-600" />
        </button>
        {word.partOfSpeech && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 font-medium capitalize"
          >
            {word.partOfSpeech}
          </Badge>
        )}
      </div>

      {/* ── Hindi meaning ── */}
      {word.hindiMeaning && (
        <p className="text-base font-semibold text-primary leading-snug">
          {word.hindiMeaning}
        </p>
      )}

      {/* ── English meaning ── */}
      {word.englishMeaning && (
        <p className="text-sm text-foreground/80 leading-relaxed">
          {word.englishMeaning}
        </p>
      )}

      {/* ── Similar words ── */}
      {word.synonyms && word.synonyms.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Similar words
          </p>
          <div className="flex flex-wrap gap-1.5">
            {word.synonyms.map((syn) => (
              <span
                key={syn}
                className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground/80"
              >
                {syn}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Example sentence ── */}
      {word.exampleSentence && (
        <div className="pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Example
          </p>
          <p className="text-sm italic text-foreground/85 leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50">
            &ldquo;{word.exampleSentence}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
