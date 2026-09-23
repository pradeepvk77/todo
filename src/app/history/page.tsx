import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getHistoryTableData } from "@/app/actions/history";
import { getFriendNicknamePreference } from "@/app/actions";
import { HistoryPageClient } from "@/components/HistoryPageClient";

export const revalidate = 0;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { user } = await searchParams;
  const otherUser = user === "other";
  const defaultOtherUserName = session.userId === "user1" ? "User 2" : "User 1";

  const [summaries, friendNickname] = await Promise.all([
    getHistoryTableData(otherUser ? "other" : undefined),
    getFriendNicknamePreference(),
  ]);

  const otherUserName = friendNickname || defaultOtherUserName;

  return (
    <HistoryPageClient
      initialSummaries={summaries}
      otherUser={otherUser}
      otherUserName={otherUserName}
    />
  );
}
