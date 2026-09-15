import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDailyVocabulary, getVocabularyHistory, getAllVocabularyWords } from "@/app/actions/vocabulary";
import { getISTDateString } from "@/lib/time-utils";
import { VocabularyPageClient } from "@/components/VocabularyPage";
import type { Metadata } from "next";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Daily Vocabulary — Lets Do It",
  description: "Learn 5 new English words every day with Hindi meanings, examples, and pronunciations.",
};

export default async function VocabularyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = getISTDateString();

  const [todayData, historyDates, allWords] = await Promise.all([
    getDailyVocabulary(today),
    getVocabularyHistory(),
    getAllVocabularyWords(),
  ]);

  return (
    <VocabularyPageClient
      today={today}
      todayData={todayData}
      historyDates={historyDates}
      allWords={allWords}
    />
  );
}
