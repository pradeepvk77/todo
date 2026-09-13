import { BarChart3, ClipboardList, LogOut, MoreVertical, Pencil, Settings, User, Users } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export function TaskMenu({ otherUser = false, otherUserName }: { otherUser?: boolean; otherUserName: string }) {
  const suffix = otherUser ? "?user=other" : "";
  return <details className="relative">
    <summary
      className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
      aria-label="Open task menu"
    >
      <MoreVertical className="size-4" />
    </summary>
    <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
      {!otherUser && <Link href="/edit-tasks" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><Pencil className="size-4" />Edit tasks</Link>}
      {!otherUser && <Link href="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><Settings className="size-4" />Settings</Link>}
      <Link href={`/analytics${suffix}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><BarChart3 className="size-4" />Analytics</Link>
      <Link href={`/history${suffix}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><ClipboardList className="size-4" />Task history</Link>
      <div className="my-1 border-t border-border" />
      <Link href={otherUser ? "/" : "/?user=other"} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">
        {otherUser ? <User className="size-4" /> : <Users className="size-4" />}
        {otherUser ? "My tasks" : `${otherUserName}'s tasks`}
      </Link>
      <form action={logoutAction}>
        <button type="submit" className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"><LogOut className="size-4" />Logout</button>
      </form>
    </div>
  </details>;
}
