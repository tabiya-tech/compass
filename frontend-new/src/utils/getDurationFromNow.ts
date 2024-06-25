export function getDurationFromNow(givenDate: Date): string {
  const duration = getSafeDate(new Date()).getTime() - getSafeDate(givenDate).getTime();

  if (duration < 0) throw new Error("Invalid date range: First date must be before second date");

  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 7) {
    const date = getSafeDate(givenDate);
    return `on ${date.toLocaleDateString()}`;
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

// We need to ensure that the date is a valid Date object before we can use it.
// For example storybook's date input returns a string, so we need to convert it to a Date object.
function getSafeDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}
