export function getDurationFromNow(givenDate: Date): string {
  const now = getSafeDate(new Date());
  const given = getSafeDate(givenDate);

  const duration = now.getTime() - given.getTime();

  if (duration < 0) throw new Error("Invalid date range: First date must be before second date");

  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 7) {
    return `on ${given.toLocaleDateString("en-GB", { timeZone: "UTC" })}`;
  }

  const output = [];

  if (days === 1) {
    output.push("yesterday");
  } else if (days > 0) {
    output.push(days + " " + pluralize(days, "day") + " ago");
  } else {
    if (hours > 0) {
      output.push(hours + " " + pluralize(hours, "hour"));
    }
    if (minutes > 0) {
      output.push(minutes + " " + pluralize(minutes, "minute"));
    }
    if (!output.length) return "just now";
    return output.join(" ") + " ago";
  }

  return output.join(" ");
}

function pluralize(value: number, unit: string): string {
  return value === 1 ? unit : `${unit}s`;
}

// Ensure that the date is a valid Date object before using it and parse it as UTC
function getSafeDate(date: Date | string): Date {
  return date instanceof Date ? new Date(date.toISOString()) : new Date(new Date(date).toISOString());
}
