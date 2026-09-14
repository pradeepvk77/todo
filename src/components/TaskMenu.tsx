"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, ClipboardList, LogOut, MoreVertical, Pencil, Settings, User, Users } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export function TaskMenu({ otherUser = false, otherUserName }: { otherUser?: boolean; otherUserName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsStr = searchParams.toString();
  const [prevRouteKey, setPrevRouteKey] = useState(pathname + "?" + searchParamsStr);
  const currentRouteKey = pathname + "?" + searchParamsStr;

  if (prevRouteKey !== currentRouteKey) {
    setPrevRouteKey(currentRouteKey);
    setIsOpen(false);
  }

  // Auto-close menu when clicking outside or pressing Escape key
  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const suffix = otherUser ? "?user=other" : "";
  const closeMenu = () => setIsOpen(false);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Open task menu"
        aria-expanded={isOpen}
      >
        <MoreVertical className="size-4" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in-50 zoom-in-95 duration-100"
          onClick={closeMenu}
        >
          {!otherUser && (
            <Link
              href="/edit-tasks"
              onClick={closeMenu}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Pencil className="size-4" />
              Edit tasks
            </Link>
          )}
          {!otherUser && (
            <Link
              href="/settings"
              onClick={closeMenu}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Settings className="size-4" />
              Settings
            </Link>
          )}
          <Link
            href={`/analytics${suffix}`}
            onClick={closeMenu}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <BarChart3 className="size-4" />
            Analytics
          </Link>
          <Link
            href={`/history${suffix}`}
            onClick={closeMenu}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ClipboardList className="size-4" />
            Task history
          </Link>

          <div className="my-1 border-t border-border" />

          <Link
            href={otherUser ? "/" : "/?user=other"}
            onClick={closeMenu}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {otherUser ? <User className="size-4" /> : <Users className="size-4" />}
            {otherUser ? "My tasks" : `${otherUserName}'s tasks`}
          </Link>

          <form action={logoutAction} onSubmit={closeMenu}>
            <button
              type="submit"
              onClick={closeMenu}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-4" />
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  );
}


