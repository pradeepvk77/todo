"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getDailyVocabulary, type VocabularyWordData } from "@/app/actions/vocabulary";
import { getISTDateOffset } from "@/lib/time-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  BookOpen,
  AlertCircle,
  Trophy,
  X,
  Eye,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export interface TestQuestion {
  id: number;
  word: string;
  direction: "en-hi" | "hi-en";
  prompt: string;
  correctAnswer: string;
  options: string[];
  selectedAnswer: string | null;
  isCorrect: boolean | null;
}

export interface VocabularyTestProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Fisher-Yates array shuffle helper
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates 10 questions client-side from a given pool of vocabulary words
 */
function generateTestQuestions(pool: VocabularyWordData[]): TestQuestion[] {
  if (pool.length < 10) return [];

  // Pick 10 unique words at random
  const selectedWords = shuffleArray(pool).slice(0, 10);

  return selectedWords.map((wordData, index) => {
    // 50% chance English -> Hindi, 50% Hindi -> English
    const direction: "en-hi" | "hi-en" = Math.random() < 0.5 ? "en-hi" : "hi-en";

    let prompt: string;
    let correctAnswer: string;

    if (direction === "en-hi") {
      prompt = `What does "${wordData.word}" mean?`;
      correctAnswer = wordData.hindiMeaning;
    } else {
      prompt = `"${wordData.hindiMeaning}" का English meaning क्या है?`;
      correctAnswer = wordData.word;
    }

    // Pick 2 distractors from pool (excluding current word)
    const otherWords = pool.filter((w) => w.id !== wordData.id);
    const shuffledOthers = shuffleArray(otherWords);

    const distractors: string[] = [];
    for (const other of shuffledOthers) {
      if (distractors.length >= 2) break;
      const candidateVal = direction === "en-hi" ? other.hindiMeaning : other.word;
      if (
        candidateVal !== correctAnswer &&
        !distractors.includes(candidateVal) &&
        candidateVal.trim().length > 0
      ) {
        distractors.push(candidateVal);
      }
    }

    // Fallback if not enough distinct distractors found
    while (distractors.length < 2) {
      distractors.push(direction === "en-hi" ? "अन्य अर्थ" : "Option");
    }

    const options = shuffleArray([correctAnswer, ...distractors]);

    return {
      id: index + 1,
      word: wordData.word,
      direction,
      prompt,
      correctAnswer,
      options,
      selectedAnswer: null,
      isCorrect: null,
    };
  });
}

function getPerformanceMessage(percentage: number): string {
  if (percentage >= 90) return "Excellent recall!";
  if (percentage >= 70) return "Great job! Keep practicing.";
  if (percentage >= 50) return "Good start. A little more practice will help.";
  return "Keep practicing. You'll improve with repetition.";
}

export function VocabularyTest({ isOpen, onClose }: VocabularyTestProps) {
  const [phase, setPhase] = useState<
    "loading" | "insufficient_data" | "ready" | "running" | "result" | "review"
  >("loading");

  const [targetDateStr, setTargetDateStr] = useState<string>("");
  const [pool, setPool] = useState<VocabularyWordData[]>([]);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(50);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load 5-days-ago vocabulary ONCE when test is opened
  useEffect(() => {
    if (!isOpen) return;

    const fiveDaysAgo = getISTDateOffset(-5);
    setTargetDateStr(fiveDaysAgo);
    setPhase("loading");

    let isSubscribed = true;

    async function loadTestData() {
      try {
        const data = await getDailyVocabulary(fiveDaysAgo);
        if (!isSubscribed) return;

        if (!data || !data.words || data.words.length < 10) {
          setPhase("insufficient_data");
          return;
        }

        setPool(data.words);
        const initialQuestions = generateTestQuestions(data.words);
        setQuestions(initialQuestions);
        setPhase("ready");
      } catch (err) {
        console.error("Failed to load test vocabulary:", err);
        if (isSubscribed) setPhase("insufficient_data");
      }
    }

    loadTestData();

    return () => {
      isSubscribed = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  // Clean up timer on unmount / close
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const finishTest = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Evaluate unanswered questions as incorrect (Rule 2)
    setQuestions((prevQuestions) =>
      prevQuestions.map((q) => {
        if (q.selectedAnswer === null) {
          return {
            ...q,
            selectedAnswer: null,
            isCorrect: false,
          };
        }
        return q;
      })
    );

    setPhase("result");
  }, []);

  // Shared 50-second timer
  useEffect(() => {
    if (phase !== "running") return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, finishTest]);

  if (!isOpen) return null;

  function handleStartTest() {
    setCurrentIndex(0);
    setTimeLeft(50);
    setPhase("running");
  }

  function handleSelectOption(option: string) {
    if (phase !== "running") return;
    const currentQ = questions[currentIndex];
    if (!currentQ || currentQ.selectedAnswer !== null) return; // prevent changing answer

    const isRight = option === currentQ.correctAnswer;

    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === currentIndex
          ? {
              ...q,
              selectedAnswer: option,
              isCorrect: isRight,
            }
          : q
      )
    );
  }

  function handleNextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      finishTest();
    }
  }

  function handleTryAgain() {
    if (timerRef.current) clearInterval(timerRef.current);
    const newQs = generateTestQuestions(pool);
    setQuestions(newQs);
    setCurrentIndex(0);
    setTimeLeft(50);
    setPhase("ready");
  }

  // Calculate results
  const totalQuestions = questions.length;
  const correctCount = questions.filter((q) => q.isCorrect === true).length;
  const incorrectCount = totalQuestions - correctCount;
  const scorePercentage =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const currentQuestion = questions[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-none">
                Vocabulary Recall Test
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Words from {targetDateStr ? targetDateStr : "5 days ago"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5">
          {/* PHASE: LOADING */}
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Preparing your vocabulary test...
                </p>
                <p className="text-xs text-muted-foreground">
                  Fetching vocabulary from 5 days ago ({targetDateStr})
                </p>
              </div>
            </div>
          )}

          {/* PHASE: INSUFFICIENT DATA */}
          {phase === "insufficient_data" && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="size-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertCircle className="size-6" />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <h3 className="text-base font-semibold text-foreground">
                  Not Enough Words Available
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  There are not enough vocabulary words saved from 5 days ago ({targetDateStr}) to generate a 10-question test.
                </p>
              </div>
              <Button onClick={onClose} variant="outline" size="sm" className="mt-2 cursor-pointer">
                Back to Vocabulary
              </Button>
            </div>
          )}

          {/* PHASE: READY */}
          {phase === "ready" && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-5">
              <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="size-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Your test is ready</h3>
                <p className="text-xs text-muted-foreground">
                  Test your recall on words learned 5 days ago
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-3 py-2">
                <div className="px-3 py-1.5 rounded-xl bg-muted border border-border text-xs font-medium text-foreground flex items-center gap-1.5">
                  <BookOpen className="size-3.5 text-primary" />
                  <span>10 Questions</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-muted border border-border text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-amber-500" />
                  <span>50 Seconds Total</span>
                </div>
              </div>

              <Button
                onClick={handleStartTest}
                size="lg"
                className="w-full sm:w-auto px-8 gap-2 font-semibold cursor-pointer shadow-sm"
              >
                <span>Start Test</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {/* PHASE: RUNNING */}
          {phase === "running" && currentQuestion && (
            <div className="space-y-5">
              {/* Question Header & Shared Timer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">
                    Question {currentIndex + 1} of 10
                  </span>
                  <span
                    className={`flex items-center gap-1 font-mono font-bold ${
                      timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-primary"
                    }`}
                  >
                    <Clock className="size-3.5" />
                    {timeLeft}s left
                  </span>
                </div>

                {/* Progress bar for 50s shared timer */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 linear ${
                      timeLeft <= 5 ? "bg-red-500" : "bg-primary"
                    }`}
                    style={{ width: `${(timeLeft / 50) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <Card className="rounded-xl border border-border shadow-xs bg-muted/20">
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1 min-h-[3.25rem]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {currentQuestion.direction === "en-hi" ? "English → Hindi" : "Hindi → English"}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                      {currentQuestion.prompt}
                    </h3>
                  </div>

                  {/* Options */}
                  <div className="space-y-2.5 pt-1">
                    {currentQuestion.options.map((option, optIdx) => {
                      const isSelected = currentQuestion.selectedAnswer === option;
                      const isAnswered = currentQuestion.selectedAnswer !== null;
                      const isCorrectOption = option === currentQuestion.correctAnswer;

                      let btnStyle = "border-border bg-card text-foreground hover:bg-muted/50 hover:border-primary/40";
                      let icon = null;

                      if (isAnswered) {
                        if (isCorrectOption) {
                          btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold";
                          icon = <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />;
                        } else if (isSelected && !isCorrectOption) {
                          btnStyle = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 font-semibold";
                          icon = <XCircle className="size-4 text-red-600 shrink-0" />;
                        } else {
                          btnStyle = "border-border bg-card/50 text-muted-foreground opacity-60";
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isAnswered}
                          onClick={() => handleSelectOption(option)}
                          className={`w-full flex items-center justify-between p-3.5 text-left text-sm rounded-xl border transition-all cursor-pointer ${btnStyle} ${
                            isAnswered ? "cursor-default" : ""
                          }`}
                        >
                          <span className="font-medium">{option}</span>
                          {icon}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Action footer area — reserved fixed height to prevent layout shift */}
              <div className="flex items-center justify-between h-9 pt-1">
                {currentQuestion.selectedAnswer !== null ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      {currentQuestion.isCorrect ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="size-4" /> Correct!
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                          <XCircle className="size-4" /> Incorrect
                        </span>
                      )}
                    </div>

                    <Button
                      onClick={handleNextQuestion}
                      size="sm"
                      className="gap-1.5 px-4 font-semibold cursor-pointer"
                    >
                      <span>{currentIndex < 9 ? "Next Question" : "View Results"}</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <div className="h-9" aria-hidden="true" />
                )}
              </div>
            </div>
          )}

          {/* PHASE: RESULT */}
          {phase === "result" && (
            <div className="space-y-6 py-2">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-1">
                  <Trophy className="size-8" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Your Result
                </h3>
                <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                  {correctCount} / {totalQuestions}
                  <span className="text-base sm:text-xl font-bold text-muted-foreground ml-2">
                    ({scorePercentage}%)
                  </span>
                </div>
                <p className="text-sm font-semibold text-primary">
                  {getPerformanceMessage(scorePercentage)}
                </p>
              </div>

              {/* Score breakdown card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-0.5">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Correct
                  </span>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {correctCount}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-center space-y-0.5">
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">
                    Incorrect
                  </span>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">
                    {incorrectCount}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={() => setPhase("review")}
                  variant="outline"
                  className="w-full gap-2 cursor-pointer"
                >
                  <Eye className="size-4 text-primary" />
                  <span>Review Answers</span>
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleTryAgain}
                    variant="outline"
                    className="gap-2 cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Try Again</span>
                  </Button>
                  <Button onClick={onClose} className="cursor-pointer">
                    <span>Back to Vocabulary</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* PHASE: REVIEW */}
          {phase === "review" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <button
                  onClick={() => setPhase("result")}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to Results</span>
                </button>
                <span className="text-xs font-bold text-foreground">
                  Answer Review ({correctCount}/10 Correct)
                </span>
              </div>

              {/* Questions list */}
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isUserCorrect = q.isCorrect === true;
                  const isUnanswered = q.selectedAnswer === null;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        isUserCorrect
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-red-500/30 bg-red-500/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-muted-foreground">
                            Question {idx + 1}
                          </span>
                          <p className="font-bold text-foreground text-sm leading-snug">
                            {q.prompt}
                          </p>
                        </div>
                        {isUserCorrect ? (
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Correct
                          </span>
                        ) : (
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold flex items-center gap-1">
                            <XCircle className="size-3" />{" "}
                            {isUnanswered ? "Time Expired" : "Incorrect"}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 pt-1 border-t border-border/50 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Your answer: </span>
                          <span
                            className={
                              isUserCorrect
                                ? "font-semibold text-emerald-700 dark:text-emerald-300"
                                : "font-semibold text-red-700 dark:text-red-300"
                            }
                          >
                            {isUnanswered ? "No answer (Time expired)" : q.selectedAnswer}
                          </span>
                        </div>
                        {!isUserCorrect && (
                          <div>
                            <span className="text-muted-foreground">Correct answer: </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                              {q.correctAnswer}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  onClick={handleTryAgain}
                  variant="outline"
                  className="flex-1 gap-2 cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Try Again</span>
                </Button>
                <Button onClick={onClose} className="flex-1 cursor-pointer">
                  <span>Back to Vocabulary</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
