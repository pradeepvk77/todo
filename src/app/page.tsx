import {
  getFriendNicknamePreference,
  getTodos,
  getOtherUserTodos,
  getUnreviewedMissedOccurrences,
  getTaskPerformanceHistory,
  getTodayTaskComparison,
} from "@/app/actions";
import { getDailyVocabulary } from "@/app/actions/vocabulary";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/DashboardView";
import { runWithPerfContext, trackStep, isPerfDebug } from "@/lib/perf";
import { headers } from "next/headers";

export const revalidate = 0;

function isAfterNineAMIST(): boolean {
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return nowIST.getHours() >= 9;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const pageStart = performance.now();

  const session = await trackStep("getSession", () => getSession());

  if (!session) {
    redirect("/login");
  }

  const currentUserId = session.userId;
  const { user } = await searchParams;
  const viewingOtherUser = user === "other";
  const defaultOtherUserName = currentUserId === "user1" ? "User 2" : "User 1";
  const shouldFetchUnreviewed = !viewingOtherUser && isAfterNineAMIST();

  const renderPage = async () => {
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

    let initialTaskHistory = null;
    let initialTaskComparison = null;

    if (initialTask) {
      [initialTaskHistory, initialTaskComparison] = await trackStep(
        "Promise.all[perfHistory+comparison]",
        () =>
          Promise.all([
            getTaskPerformanceHistory(initialTask.id, viewingOtherUser ? "other" : undefined),
            getTodayTaskComparison(initialTask.id),
          ])
      );
    }

    const initialDailyWord = dailyVocabData?.words?.length ? dailyVocabData.words[0] : null;

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
        />
      </main>
    );
  };

  return runWithPerfContext("page.tsx /", renderPage);
}
