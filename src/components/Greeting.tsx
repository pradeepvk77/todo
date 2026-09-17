"use client";

import { useSyncExternalStore } from "react";
import { Calendar, CheckSquare } from "lucide-react";

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return { text: "Good Morning", emoji: "☀️" };
  if (hour >= 12 && hour < 17) return { text: "Good Afternoon", emoji: "🌤️" };
  return { text: "Good Evening", emoji: "🌙" };
}

const emptySubscribe = () => () => {};

function getClientTimeData() {
  const now = new Date();
  return {
    greeting: getGreeting(now.getHours()),
    formattedDate: now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export function Greeting({ userName = "Valentine" }: { userName?: string }) {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const timeData = isMounted ? getClientTimeData() : null;

  return (
    <div className="flex items-center justify-between w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
          <span>{timeData ? `${timeData.greeting.text},` : "Hello,"}</span>
          <span className="text-foreground">{userName}</span>
          <span className="inline-block animate-bounce">👋</span>
        </h1>
        <p className="text-xs text-muted-foreground/80 font-medium mt-0.5">
          {timeData?.formattedDate ?? "Wednesday, September 16, 2026"}
        </p>
      </div>
    </div>
  );
}

