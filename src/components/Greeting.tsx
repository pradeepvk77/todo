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
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export function Greeting() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const timeData = isMounted ? getClientTimeData() : null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="p-3 bg-primary text-primary-foreground rounded-lg shadow-xs flex-shrink-0">
        <CheckSquare className="w-6 h-6" />
      </div>
      <div>
        <h1 className="whitespace-nowrap text-xl font-bold tracking-tight text-foreground sm:text-3xl">
          {timeData ? `${timeData.greeting.text} ${timeData.greeting.emoji}` : "Hello 👋"}
        </h1>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground mt-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{timeData?.formattedDate ?? ""}</span>
        </div>
      </div>
    </div>
  );
}
