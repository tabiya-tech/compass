import "src/_test_utilities/consoleMock";
import { getDurationFromNow } from "./getDurationFromNow";

function timeAgo({ days = 0, hours = 0, minutes = 0, seconds = 0 }) {
  const now = Date.now();
  const totalMilliseconds =
    (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return new Date(now - totalMilliseconds);
}


const t = (key: string, opts?: any) => {
  const translations: Record<string, string> = {
    "common.time.ago": "{{time}} ago",
    "common.time.justNow": "just now",
    "common.time.yesterday": "yesterday",
    "common.time.daySingular": "day",
    "common.time.dayPlural": "days",
    "common.time.hourSingular": "hour",
    "common.time.hourPlural": "hours",
    "common.time.minuteSingular": "minute",
    "common.time.minutePlural": "minutes",
    "common.time.onDate": "on {{date}}",
  };
  let value = translations[key] || key;
  if (opts && opts.time) {
    value = value.replace("{{time}}", opts.time);
  }
  return value;
};

describe("getDurationFromNow", () => {
  describe("durations below a week", () => {
    test("should return the expected duration in days", () => {
      // GIVEN a date 5 days ago
      const givenDate = timeAgo({ days: 5 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("5 days ago");
    });

    test("should return the expected duration in hours", () => {
      // GIVEN a date 10 hours ago
      const givenDate = timeAgo({ hours: 10 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 hours ago");
    });

    test("should return the expected duration in minutes", () => {
      // GIVEN a date 10 minutes ago
      const givenDate = timeAgo({ minutes: 10 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 minutes ago");
    });

    test("should return the expected duration in days, hours and minutes", () => {
      // GIVEN a date 5 days, 10 hours and 10 minutes ago
      const givenDate = timeAgo({ days: 5, hours: 10, minutes: 10 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("5 days ago");
    });

    test("should return yesterday when the duration is 1 day", () => {
      // GIVEN a date 24 hours ago
      const givenDate = timeAgo({ hours: 24 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("yesterday");
    });

    test("should return the expected duration in 'hour'", () => {
      // GIVEN a date 1 hour ago
      const givenDate = timeAgo({ hours: 1 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("1 hour ago");
    });

    test("should return the expected duration in 'minute'", () => {
      // GIVEN a date 1 minute ago
      const givenDate = timeAgo({ minutes: 1 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("1 minute ago");
    });
  });

  describe("durations above a week", () => {
    test("should return the formatted date when the duration is more than a week", () => {
      // GIVEN a date 10 days ago
      const givenDate = timeAgo({ days: 10 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe(`on ${givenDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}`);
    });

    test("should return the formatted date when the duration is more than a month", () => {
      // GIVEN a date 30 days ago
      const givenDate = timeAgo({ days: 30 });

      // WHEN getDurationFromNow is called with the given date
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe(`on ${givenDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}`);
    });
  });

  describe("invalid dates", () => {
    test("should return 'just now' when the dates are the same", () => {
      // GIVEN the current date
      const givenDate = new Date();

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate,t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("just now");
    });

    test("should log a warning when the given date is in the future", () => {
      // GIVEN a date in the future
      const givenDate = new Date(new Date().getTime() + 10000);

      // WHEN getDurationFromNow is called with the given date
  getDurationFromNow(givenDate, t);
      // THEN expect a warning to be logged to the console
      expect(console.warn).toHaveBeenCalledWith("Invalid date range: First date must be before second date", {
        now: expect.any(String),
        given: expect.any(String),
      });
    });

    test("should return the expected result when the dates are strings", () => {
      // GIVEN a date string
      const givenDate = "2021-10-10";

      // WHEN getDurationFromNow is called with the given date
      // @ts-ignore
  const result = getDurationFromNow(givenDate, t);

      // THEN expect the expected duration to be returned
      expect(result).toBe("on 10/10/2021");
    });
  });
});
