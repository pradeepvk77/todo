import { BarChart3, ClipboardList, MoreVertical, Pencil } from "lucide-react";
import Link from "next/link";

export function TaskMenu({ otherUser = false }: { otherUser?: boolean }) {
  const suffix = otherUser ? "?user=other" : "";
  return <details className="relative">
    <summary
      className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
      aria-label="Open task menu"
    >
      <MoreVertical className="size-4" />
    </summary>
    <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
      {!otherUser && <Link href="/edit-tasks" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><Pencil className="size-4" />Edit tasks</Link>}
      <Link href={`/analytics${suffix}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><BarChart3 className="size-4" />Analytics</Link>
      <Link href={`/history${suffix}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><ClipboardList className="size-4" />Task history</Link>
    </div>
  </details>;
}
