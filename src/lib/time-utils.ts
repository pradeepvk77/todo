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
