"use client";

import Link from "next/link";
import { LogOut, MoreVertical, User, Users } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

export function DashboardMenu({ otherUserName, viewingOtherUser }: { otherUserName: string; viewingOtherUser: boolean }) {
  return (
    <details className="relative shrink-0">
      <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden" aria-label="Open dashboard menu">
        <MoreVertical className="size-5" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
        <Link href={viewingOtherUser ? "/" : "/?user=other"} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">
          {viewingOtherUser ? <User className="size-4" /> : <Users className="size-4" />}
          {viewingOtherUser ? "My tasks" : `${otherUserName}'s tasks`}
        </Link>
        <div className="my-1 border-t border-border" />
        <form action={logoutAction}>
          <button type="submit" className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10">
            <LogOut className="size-4" />
            Logout
          </button>
        </form>
      </div>
    </details>
  );
}
