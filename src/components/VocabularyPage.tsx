"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { WordCard } from "@/components/WordCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDailyVocabulary } from "@/app/actions/vocabulary";
import type { DailyVocabularyData, AllVocabularyWordData } from "@/app/actions/vocabulary";
import {
  ArrowLeft,
  CalendarDays,
  BookOpen,
  ChevronRight,
  Loader2,
  Search,
  X,
  History,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface VocabularyPageProps {
  today: string;
  todayData: DailyVocabularyData | null;
  historyDates: string[];
  allWords: AllVocabularyWordData[];
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatShortDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function VocabularyPageClient({
  today,
  todayData,
  historyDates,
  allWords = [],
}: VocabularyPageProps) {
  const [viewMode, setViewMode] = useState<"date" | "all">("date");
  const [viewingDate, setViewingDate] = useState<string>(today);
  const [viewingData, setViewingData] = useState<DailyVocabularyData | null>(todayData);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isViewingToday = viewMode === "date" && viewingDate === today;
  const pastDates = historyDates.filter((d) => d !== today);

  // Sync initial server data into LocalStorage cache
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (todayData && todayData.words.length > 0) {
        localStorage.setItem(`todo_vocab_daily_${today}`, JSON.stringify(todayData));
      }
      if (allWords && allWords.length > 0) {
        localStorage.setItem("todo_vocab_all", JSON.stringify(allWords));
      }
      if (historyDates && historyDates.length > 0) {
        localStorage.setItem("todo_vocab_history", JSON.stringify(historyDates));
      }
    } catch {
      // LocalStorage errors ignored gracefully
    }
  }, [today, todayData, historyDates, allWords]);

  // Search filtering logic
  const searchFilteredWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allWords.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.hindiMeaning.toLowerCase().includes(q) ||
        w.englishMeaning.toLowerCase().includes(q) ||
        w.synonyms.some((s) => s.toLowerCase().includes(q))
    );
  }, [searchQuery, allWords]);

  function handleSelectDate(date: string) {
    setShowHistoryDropdown(false);
    setViewMode("date");
    if (date === viewingDate && viewMode === "date") return;
    setError(null);

    // 1. Check LocalStorage first for zero-lag instant UI rendering
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`todo_vocab_daily_${date}`);
        if (cached) {
          const parsed = JSON.parse(cached) as DailyVocabularyData;
          if (parsed && Array.isArray(parsed.words) && parsed.words.length > 0) {
            setViewingDate(date);
            setViewingData(parsed);
            return;
          }
        }
      } catch {
        // Fall through to server fetch
      }
    }

    // 2. LocalStorage cache miss -> fetch from DB / server with loading indicator
    startTransition(async () => {
      const data = await getDailyVocabulary(date);
      if (!data) {
        setError("Could not load vocabulary for this date.");
      } else {
        setViewingDate(date);
        setViewingData(data);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`todo_vocab_daily_${date}`, JSON.stringify(data));
          } catch {
            // Ignore
          }
        }
      }
    });
  }

  function handleSwitchToToday() {
    setShowHistoryDropdown(false);
    setViewMode("date");
    setViewingDate(today);

    // Check LocalStorage cache for today
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`todo_vocab_daily_${today}`);
        if (cached) {
          const parsed = JSON.parse(cached) as DailyVocabularyData;
          if (parsed && Array.isArray(parsed.words) && parsed.words.length > 0) {
            setViewingData(parsed);
            setError(null);
            return;
          }
        }
      } catch {
        // Ignore
      }
    }

    setViewingData(todayData);
    setError(null);
  }

  function handleSwitchToAllWords() {
    setShowHistoryDropdown(false);
    setViewMode("all");
    setError(null);
  }

  return (
    <main className="min-h-screen w-full max-w-xl mx-auto px-4 py-8 sm:px-6 space-y-5">
      {/* ── Top Header ── */}
      <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="size-3.5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Daily Vocabulary
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            20 new English words every day with Hindi meanings
          </p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2 cursor-pointer shrink-0">
            <ArrowLeft className="size-3.5" />
            Home
          </Button>
        </Link>
      </header>

      {/* ── Top Search Input ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search words, Hindi meaning, definition..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-md hover:bg-muted"
            title="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ── Sub-header: Current Date / Mode Label + Buttons on Right Side of Today ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Left: Mode / Date Indicator */}
        <div className="flex items-center gap-2">
          {viewMode === "all" ? (
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <Layers className="size-4 text-primary shrink-0" />
              <span>All Saved Words ({allWords.length})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground">
                {isViewingToday ? "Today" : formatDisplayDate(viewingDate)}
              </span>
              {!isViewingToday && (
                <span className="text-xs text-muted-foreground">
                  ({formatShortDate(viewingDate)})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side of Today: Buttons for "Today", "Previous Days", "All Words" */}
        <div className="relative flex items-center gap-1.5 ml-auto">
          {!isViewingToday && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitchToToday}
              className="cursor-pointer text-xs h-8 px-2.5 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Sparkles className="size-3.5" />
              Today
            </Button>
          )}

          <Button
            variant={viewMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={handleSwitchToAllWords}
            className="cursor-pointer text-xs h-8 px-2.5 gap-1.5"
          >
            <Layers className="size-3.5" />
            All Words
          </Button>

          {pastDates.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoryDropdown((prev) => !prev)}
              className="cursor-pointer text-xs h-8 px-2.5 gap-1.5"
            >
              <History className="size-3.5" />
              Previous Days
            </Button>
          )}

          {/* Previous Days dropdown menu */}
          {showHistoryDropdown && (
            <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-border bg-card p-1.5 shadow-lg space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Select Date
              </div>
              {pastDates.map((date) => (
                <button
                  key={date}
                  onClick={() => handleSelectDate(date)}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                    viewMode === "date" && viewingDate === date
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    {formatDisplayDate(date)}
                  </span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Loading state ── */}
      {isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading words…</span>
        </div>
      )}

      {/* ── Search Active Mode ── */}
      {!isPending && searchQuery.trim().length > 0 && (
        <section className="space-y-3" aria-label="Search results">
          <p className="text-xs font-medium text-muted-foreground">
            Found {searchFilteredWords.length} matching word{searchFilteredWords.length === 1 ? "" : "s"}
          </p>
          {searchFilteredWords.length === 0 ? (
            <Card className="rounded-xl border border-border shadow-xs">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No words match &ldquo;{searchQuery}&rdquo;
              </CardContent>
            </Card>
          ) : (
            searchFilteredWords.map((word, i) => (
              <WordCard key={word.id} word={word} index={i} />
            ))
          )}
        </section>
      )}

      {/* ── View Mode: All Words ── */}
      {!isPending && !searchQuery && viewMode === "all" && (
        <section className="space-y-3" aria-label="All saved vocabulary words">
          {allWords.length === 0 ? (
            <Card className="rounded-xl border border-border shadow-xs">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No vocabulary words saved yet.
              </CardContent>
            </Card>
          ) : (
            allWords.map((word, i) => (
              <WordCard key={word.id} word={word} index={i} />
            ))
          )}
        </section>
      )}

      {/* ── View Mode: Specific Date Words ── */}
      {!isPending && !searchQuery && viewMode === "date" && (
        <>
          {error && (
            <Card className="rounded-xl border border-border shadow-xs">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
              </CardContent>
            </Card>
          )}

          {(!viewingData || viewingData.words.length === 0) && (
            <Card className="rounded-xl border border-border shadow-xs">
              <CardContent className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-foreground">Words not available yet</p>
                <p className="text-xs text-muted-foreground">
                  Please try refreshing the page.
                </p>
              </CardContent>
            </Card>
          )}

          {viewingData && viewingData.words.length > 0 && (
            <section className="space-y-3" aria-label="Vocabulary words">
              {viewingData.words.map((word, i) => (
                <WordCard key={word.id} word={word} index={i} />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
