import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { getFriendNicknamePreference } from "@/app/actions";
import { SettingsForm } from "@/components/SettingsForm";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const revalidate = 0;

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const defaultOtherUserName = session.userId === "user1" ? "User 2" : "User 1";
  const friendNickname = (await getFriendNicknamePreference()) || defaultOtherUserName;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7 flex items-center gap-3">
        <Link href="/" className={buttonVariants({ variant: "outline", size: "icon", className: "cursor-pointer" })} aria-label="Back to tasks">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Settings className="size-5" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Notifications and friend name</p>
          </div>
        </div>
      </div>
      <SettingsForm defaultFriendNickname={friendNickname} />
    </main>
  );
}
