import {
  getFriendNicknamePreference,
  getTodos,
  getOtherUserTodos,
  getUnreviewedMissedOccurrences,
  getTaskPerformanceHistory,
  getTodayTaskComparison,
  runDailyMaintenance,
  needsDailyReset,
  performDailyResetForUser,
} from "@/app/actions";
import { getDailyVocabulary } from "@/app/actions/vocabulary";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { DashboardView } from "@/components/DashboardView";
import { runWithPerfContext, trackStep, isPerfDebug } from "@/lib/perf";
import { getISTTimeOfDay } from "@/lib/time-utils";

export const revalidate = 0;

function isAfterNineAMIST(): boolean {
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return nowIST.getHours() >= 9;
}

function getOtherUserId(userId: string): string {
  return userId === "user1" ? "user2" : "user1";
}

export default async function Home({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const pageStart = performance.now();

  const session = await trackStep("getSession", () => getSession());
  if (!session) redirect("/login");

  const currentUserId = session.userId;
  const otherUserId = getOtherUserId(currentUserId);
  const { user } = await searchParams;
  const viewingOtherUser = user === "other";
  const defaultOtherUserName = currentUserId === "user1" ? "User 2" : "User 1";
  const shouldFetchUnreviewed = !viewingOtherUser && isAfterNineAMIST();

  // ── Schedule daily maintenance to run AFTER the response is sent ──────────
  // after() keeps the serverless function alive after streaming is done.
  // runDailyMaintenance is idempotent: WHERE guards prevent double-work even
  // if two simultaneous page loads both schedule it.
  after(async () => {
    try {
      await runDailyMaintenance(currentUserId, otherUserId);
    } catch (err) {
      console.error("[after] runDailyMaintenance failed:", err);
    }
  });

  const renderPage = async () => {
    // ── Daily reset pre-check (cheap, ~1ms, first open of day only) ──────────
    // If any todo for the current user hasn't been reset today (IST), run the
    // reset synchronously NOW before fetching todos. This ensures the rendered
    // tasks are already in post-reset state (completed=false) on first open.
    //
    // Idempotency under concurrent requests: both will see needsDailyReset=true
    // and both will run the UPDATE, but the WHERE guard ensures only the first
    // call changes rows — the second is a silent no-op. ✓
    //
    // The after() call still runs migrateLegacyTaskSections and
    // detectNoActionOccurrences post-response (those are the heavy parts).
    const resetNeeded = await trackStep(
      "needsDailyReset",
      () => needsDailyReset(currentUserId)
    );
    if (resetNeeded) {
      await trackStep("preRenderDailyReset", () => performDailyResetForUser(currentUserId));
    }

    // ── All independent queries run in a single Promise.all ───────────────────
    const [
      { todos: myTodos },
      otherData,
      friendNickname,
      dailyVocabData,
      unreviewed,
    ] = await trackStep("Promise.all[todos+other+nick+vocab+unreviewed]", () =>
      Promise.all([
        getTodos("today"),
        getOtherUserTodos(),
        trackStep("getFriendNicknamePreference", () => getFriendNicknamePreference()),
        trackStep("getDailyVocabulary", () => getDailyVocabulary()),
        shouldFetchUnreviewed
          ? trackStep("getUnreviewedMissedOccurrences", () => getUnreviewedMissedOccurrences())
          : Promise.resolve([]),
      ])
    );

    const otherUserName = friendNickname || defaultOtherUserName;
    const targetTodos = viewingOtherUser ? otherData.todos : myTodos;
    const pendingTodos = targetTodos.filter((t) => !t.completed && !t.skipped);
    const initialTask = pendingTodos.length > 0 ? pendingTodos[0] : null;

    const initialTaskHistory = null;
    const initialTaskComparison = null;

    const initialDailyWord = dailyVocabData?.words?.length ? dailyVocabData.words[0] : null;
    const initialTimeOfDay = getISTTimeOfDay();

    if (isPerfDebug) {
      const total = performance.now() - pageStart;
      console.log(`[PERF PAGE] Total page.tsx execution: ${total.toFixed(2)}ms`);
    }

    return (
      <main className="min-h-screen py-5 sm:py-6 px-4 sm:px-6 w-full max-w-xl mx-auto">
        <DashboardView
          myTodos={myTodos}
          otherTodos={otherData.todos}
          otherUserName={otherUserName}
          viewingOtherUser={viewingOtherUser}
          initialDailyWord={initialDailyWord}
          initialUnreviewed={unreviewed}
          initialTaskHistory={initialTaskHistory}
          initialTaskComparison={initialTaskComparison}
          initialTimeOfDay={initialTimeOfDay}
        />
      </main>
    );
  };

  return runWithPerfContext("page.tsx /", renderPage);
}
