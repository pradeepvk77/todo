export const ON_TIME_TOLERANCE_MINUTES = 15; // Configurable business threshold for punctuality (minutes)

export function getISTHourFromTimestamp(timestampStr?: string | null): number | null {
  if (!timestampStr) return null;
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) return null;
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(d);
    return parseInt(hourStr, 10) % 24;
  } catch {
    return null;
  }
}

export function getTimeOfDaySection(hour: number | null): "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | null {
  if (hour === null) return null;
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 21) return "EVENING";
  return "NIGHT"; // 21:00 - 04:59
}

export function parseScheduledTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function parseTimestampToISTMinutes(timestampStr?: string | null): number | null {
  if (!timestampStr) return null;
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    return hour * 60 + minute;
  } catch {
    return null;
  }
}
