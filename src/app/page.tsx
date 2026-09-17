import { getFriendNicknamePreference, getTodos, getOtherUserTodos } from "@/app/actions";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/DashboardView";

export const revalidate = 0;

export default async function Home({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const currentUserId = session.userId;
  const { user } = await searchParams;
  const viewingOtherUser = user === "other";
  const defaultOtherUserName = currentUserId === "user1" ? "User 2" : "User 1";

  const [{ todos: myTodos }, otherData, friendNickname] = await Promise.all([
    getTodos("today"),
    getOtherUserTodos(),
    getFriendNicknamePreference(),
  ]);
  const otherUserName = friendNickname || defaultOtherUserName;

  return (
    <main className="min-h-screen py-5 sm:py-6 px-4 sm:px-6 w-full max-w-xl mx-auto">
      <DashboardView
        myTodos={myTodos}
        otherTodos={otherData.todos}
        otherUserName={otherUserName}
        viewingOtherUser={viewingOtherUser}
      />
    </main>
  );
}
