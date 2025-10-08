/**
 * Calculates and formats the duration between the given date and the current date,
 * returning a human-readable string such as "5 days ago", "10 minutes ago", or "on 10/10/2021".
 *
 * The function uses a translation function (`t`) to support localization, allowing
 * placeholders like `{{time}}` to be replaced dynamically (e.g., "5 days ago" → `t("ago", { time: "5 days" })`).
 *
 * @param {Date | string} givenDate - The past date to compare with the current time. Can be a Date object or ISO string.
 * @param {(key: string, opts?: any) => string} t - Translation function that supports interpolation via `{{time}}`.
 * @returns {string} A human-readable string representing how long ago the given date occurred.
 *
 * @example
 * // With English translation function
 * getDurationFromNow(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), t);
 * // => "5 days ago"
 *
 * getDurationFromNow("2021-10-10", t);
 * // => "on 10/10/2021"
 */
export function getDurationFromNow(givenDate: Date | string, t: any): string {
  const now = getSafeDate(new Date());
  const given = getSafeDate(givenDate);
  const duration = now.getTime() - given.getTime();

  if (duration < 0) {
    console.warn("Invalid date range: First date must be before second date", {
      now: now.toISOString(),
      given: given.toISOString(),
    });
  }

  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  // More than a week → format date
  if (days > 7) {
    return `on ${given.toLocaleDateString("en-GB", { timeZone: "UTC" })}`;
  }

  // Handle special and pluralized cases
  if (days === 1) return t("yesterday");
  if (days > 1)
    return t("ago", { time: `${days} ${pluralize(days, t(days === 1 ? "day" : "days"))}` });
  if (hours > 0)
    return t("ago", { time: `${hours} ${pluralize(hours, t(hours === 1 ? "hour" : "hours"))}` });
  if (minutes > 0)
    return t("ago", { time: `${minutes} ${pluralize(minutes, t(minutes === 1 ? "minute" : "minutes"))}` });

  return t("just_now");
}

/**
 * Returns the pluralized form of a time unit (e.g., "day" vs. "days").
 *
 * Note: In English, this simply adds or omits the "s" suffix. For other languages,
 * you should modify the translation keys instead of this logic.
 *
 * @param {number} value - The numeric amount of the unit.
 * @param {string} unit - The base unit (e.g., "day", "hour", "minute").
 * @returns {string} The pluralized or singular form of the unit.
 *
 * @example
 * pluralize(1, "day");   // => "day"
 * pluralize(3, "hour");  // => "hour"
 */
function pluralize(value: number, unit: string): string {
  return value === 1 ? unit : `${unit}`;
}

/**
 * Ensures the input is a valid Date object and normalizes it to UTC.
 * Accepts both Date objects and date strings.
 *
 * @param {Date | string} date - The date input to normalize.
 * @returns {Date} A safe Date object in UTC.
 *
 * @example
 * getSafeDate("2021-10-10");
 * // => Date object representing 2021-10-10T00:00:00.000Z
 */
function getSafeDate(date: Date | string): Date {
  return date instanceof Date ? new Date(date.toISOString()) : new Date(new Date(date).toISOString());
}
