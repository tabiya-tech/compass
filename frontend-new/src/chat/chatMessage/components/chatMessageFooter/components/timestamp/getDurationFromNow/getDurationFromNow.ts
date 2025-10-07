/**
 * Calculates and formats the duration between the given date and the current date,
 * returning a human-readable string such as "5 days ago", "10 minutes ago", or "on 10/10/2021".
 *
 * The function uses a translation function (`t`) to support localization, allowing
 * placeholders like `{{time}}` to be replaced dynamically (e.g., "5 days ago" → `t("common.time.ago", { time: "5 days" })`).
 *
 * @param {Date } givenDate - The past date to compare with the current time. Can be a Date object or ISO string.
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
export function getDurationFromNow(givenDate: Date, t: any): string {
  const now = getSafeDate(new Date());
  const given = getSafeDate(givenDate);
  const duration = now.getTime() - given.getTime();

  if (duration < 0) {
    console.warn("Invalid date range: First date must be before second date", {
      now: now.toISOString(),
      given: given.toISOString(),
    });
    return t("common.time.justNow");
  }

  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  // Handle special and pluralized cases
  if (days === 1) return t("common.time.yesterday");

  // More than a week → format date
  if (days > 7) {
    return t("common.time.onDate", { date: given.toLocaleDateString() });
  }

  if (days > 1) {
    return t("common.time.ago", { time: `${days} ${t("common.time.dayPlural")}` });
  }
  if (hours > 0) {
    const unitKey = hours === 1 ? "common.time.hourSingular" : "common.time.hourPlural";
    return t("common.time.ago", {
      time: `${hours} ${t(unitKey)}`,
    });
  }
  if (minutes > 0) {
    const unitKey = minutes === 1 ? "common.time.minuteSingular" : "common.time.minutePlural";
    return t("common.time.ago", {
      time: `${minutes} ${t(unitKey)}`,
    });
  }

  return t("common.time.justNow");
}
/**
 * Ensures the input is a valid Date object and normalizes it to UTC.
 * Accepts both Date objects.
 *
 * @param {Date } date - The date input to normalize.
 * @returns {Date} A safe Date object in UTC.
 *
 * @example
 * getSafeDate("2021-10-10");
 * // => Date object representing 2021-10-10T00:00:00.000Z
 */
function getSafeDate(date: Date): Date {
  return date instanceof Date ? new Date(date.toISOString()) : new Date(new Date(date).toISOString());
}
