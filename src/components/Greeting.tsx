"use client";

import { useState, useEffect } from "react";
import { Calendar, CheckSquare } from "lucide-react";

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return { text: "Good Morning", emoji: "☀️" };
  if (hour >= 12 && hour < 17) return { text: "Good Afternoon", emoji: "🌤️" };
  return { text: "Good Evening", emoji: "🌙" };
}

export function Greeting() {
  // Start with null to avoid SSR/client mismatch (hydration)
  const [greeting, setGreeting] = useState<{ text: string; emoji: string } | null>(null);
  const [formattedDate, setFormattedDate] = useState<string>("");

  useEffect(() => {
    // Runs only in the browser — always uses the user's local timezone
    const now = new Date();
    setGreeting(getGreeting(now.getHours()));
    setFormattedDate(
      now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="p-3 bg-primary text-primary-foreground rounded-lg shadow-xs flex-shrink-0">
        <CheckSquare className="w-6 h-6" />
      </div>
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {/* Show a neutral placeholder during SSR / before hydration */}
          {greeting ? `${greeting.text} ${greeting.emoji}` : "Hello 👋"}
        </h1>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground mt-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
