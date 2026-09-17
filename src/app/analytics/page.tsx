import { getFriendNicknamePreference } from "@/app/actions";
import { getAllTasksAnalytics, getIndividualTaskAnalytics, TimeRange } from "@/app/actions/analytics";
import { AnalyticsPageClient } from "@/components/AnalyticsPageClient";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const revalidate = 0;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; taskId?: string; range?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const resolvedParams = await searchParams;
  const otherUser = resolvedParams.user === "other";
  const targetUserId = otherUser ? (session.userId === "user1" ? "user2" : "user1") : session.userId;
  const defaultOtherUserName = session.userId === "user1" ? "User 2" : "User 1";
  const friendNickname = await getFriendNicknamePreference();
  const otherUserName = friendNickname || defaultOtherUserName;

  const range: TimeRange = (resolvedParams.range as TimeRange) || "last_7_days";
  const taskId = resolvedParams.taskId ? parseInt(resolvedParams.taskId, 10) : null;

  let initialAllData = null;
  let initialTaskData = null;

  if (taskId && !isNaN(taskId)) {
    try {
      initialTaskData = await getIndividualTaskAnalytics(taskId, range, targetUserId);
    } catch {
      initialAllData = await getAllTasksAnalytics("last_7_days", targetUserId);
    }
  } else {
    initialAllData = await getAllTasksAnalytics(range, targetUserId);
  }

  return (
    <main className="min-h-screen w-full max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      <AnalyticsPageClient
        initialAllData={initialAllData}
        initialTaskData={initialTaskData}
        isOtherUser={otherUser}
        otherUserName={otherUserName}
        initialTaskId={taskId}
        initialTimeRange={range}
      />
    </main>
  );
}

