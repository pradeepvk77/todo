"use client";

import { useSyncExternalStore } from "react";

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return { text: "Good Morning", emoji: "☀️" };
  if (hour >= 12 && hour < 17) return { text: "Good Afternoon", emoji: "🌤️" };
  return { text: "Good Evening", emoji: "🌙" };
}

const emptySubscribe = () => () => {};

let cachedSnapshot: {
  greeting: { text: string; emoji: string };
  formattedDate: string;
  hour: number;
} | null = null;

function getSnapshot() {
  const now = new Date();
  const istHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  );

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  if (
    cachedSnapshot &&
    cachedSnapshot.hour === istHour &&
    cachedSnapshot.formattedDate === formattedDate
  ) {
    return cachedSnapshot;
  }

  cachedSnapshot = {
    greeting: getGreeting(istHour),
    formattedDate,
    hour: istHour,
  };

  return cachedSnapshot;
}

export function Greeting({ userName = "Valentine" }: { userName?: string }) {
  const timeData = useSyncExternalStore(
    emptySubscribe,
    getSnapshot,
    getSnapshot
  );

  return (
    <div className="flex items-center justify-between w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
          <span>{`${timeData.greeting.text},`}</span>
          <span className="text-foreground">{userName || "Valentine"}</span>
          {/* Pure transform animation — 0px vertical layout shift */}
          <span
            aria-hidden="true"
            className="inline-block select-none origin-bottom-right hover:rotate-12 transition-transform duration-200"
          >
            👋
          </span>
        </h1>
        {/* WCAG AA contrast ratio >= 4.5:1 using text-zinc-600 dark:text-zinc-400 */}
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mt-0.5">
          {timeData.formattedDate}
        </p>
      </div>
    </div>
  );
}
