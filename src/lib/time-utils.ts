export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export const WEEKENDS = ["saturday", "sunday"] as const;
export const ALL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday", short: "Mon" },
  { value: "tuesday", label: "Tuesday", short: "Tue" },
  { value: "wednesday", label: "Wednesday", short: "Wed" },
  { value: "thursday", label: "Thursday", short: "Thu" },
  { value: "friday", label: "Friday", short: "Fri" },
  { value: "saturday", label: "Saturday", short: "Sat" },
  { value: "sunday", label: "Sunday", short: "Sun" },
] as const;

export type AssignedDay = typeof DAYS_OF_WEEK[number]["value"] | "everyday";

/**
 * Returns current date string in IST timezone (Asia/Kolkata) formatted as YYYY-MM-DD
 */
export function getISTDateString(date = new Date()): string {
  const istFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return istFormatter.format(date);
}

/**
 * Returns current day of week in IST timezone (Asia/Kolkata) lowercase (e.g. "saturday")
 */
export function getISTDayOfWeek(date = new Date()): string {
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  });
  return istFormatter.format(date).toLowerCase();
}

/**
 * Alarm-style Day Formatter: formats a comma-separated days string (e.g., "monday,friday")
 * into a user-friendly label (e.g., "Mon, Fri", "Weekdays", "Weekends", "Everyday", or "No Days").
 */
export function formatAssignedDays(daysInput?: string): string {
  if (daysInput === undefined || daysInput === null) return "Everyday";
  if (daysInput.trim() === "") return "No Days";
  if (daysInput === "everyday") return "Everyday";

  const selected = daysInput
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (selected.length === 0) return "No Days";
  if (selected.length === 7) return "Everyday";

  const isWeekdaysOnly =
    selected.length === 5 && WEEKDAYS.every((d) => selected.includes(d));
  if (isWeekdaysOnly) return "Weekdays";

  const isWeekendsOnly =
    selected.length === 2 && WEEKENDS.every((d) => selected.includes(d));
  if (isWeekendsOnly) return "Weekends";

  // Map to short day names in chronological order
  const shortNames = DAYS_OF_WEEK.filter((d) => selected.includes(d.value)).map(
    (d) => d.short
  );

  return shortNames.join(", ") || "No Days";
}

/**
 * Checks if a task assigned to daysInput (e.g., "monday,friday", "everyday", or "") is active on targetDay (e.g., "monday").
 */
export function isTaskActiveOnDay(daysInput: string | undefined, targetDay: string): boolean {
  if (daysInput === undefined || daysInput === null) return true;
  if (daysInput.trim() === "") return false;
  if (daysInput === "everyday") return true;

  const selected = daysInput.split(",").map((d) => d.trim().toLowerCase());
  return selected.includes(targetDay.toLowerCase());
}

/**
 * Generates a list of time options in "hh:mm AM/PM" format with 15-minute intervals,
 * starting from the current time (rounded up to the next 15-minute mark).
 */
export function generate15MinTimeOptions(): string[] {
  const options: string[] = [];
  const now = new Date();

  // Round up to nearest 15-minute interval
  let minutes = Math.ceil(now.getMinutes() / 15) * 15;
  let hours = now.getHours();

  if (minutes >= 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }

  // Generate 96 intervals (24 hours * 4 quarters)
  for (let i = 0; i < 96; i++) {
    const curHour = (hours + Math.floor((minutes + i * 15) / 60)) % 24;
    const curMin = (minutes + i * 15) % 60;

    const period = curHour >= 12 ? "PM" : "AM";
    const displayHour = curHour % 12 === 0 ? 12 : curHour % 12;
    const formattedHour = String(displayHour).padStart(2, "0");
    const formattedMin = String(curMin).padStart(2, "0");

    options.push(`${formattedHour}:${formattedMin} ${period}`);
  }

  return options;
}
