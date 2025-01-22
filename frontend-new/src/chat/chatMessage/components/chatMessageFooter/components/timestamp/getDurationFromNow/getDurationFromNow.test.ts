import "src/_test_utilities/consoleMock";
import { getDurationFromNow } from "./getDurationFromNow";

describe("getDurationFromNow", () => {
  describe("durations below a week", () => {
    test("should return the expected duration in days", () => {
      // GIVEN a date 5 days ago
      const givenDate = new Date(new Date().setDate(new Date().getDate() - 5));

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("5 days ago");
    });

    test("should return the expected duration in hours", () => {
      // GIVEN a date 10 hours ago
      const givenDate = new Date(new Date().getTime() - 10 * 60 * 60 * 1000);

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 hours ago");
    });

    test("should return the expected duration in minutes", () => {
      // GIVEN a date 10 minutes ago
      const givenDate = new Date(new Date().getTime() - 10 * 60 * 1000);

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 minutes ago");
    });

    test("should return the expected duration in days, hours and minutes", () => {
      // GIVEN a date 5 days, 10 hours and 10 minutes ago
      const givenDate = new Date(
        new Date().getTime() - (5 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000 + 10 * 60 * 1000)
      );

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("5 days ago");
    });

    test("should return yesterday when the duration is 1 day", () => {
      // GIVEN a date 1 day ago
      const givenDate = new Date(new Date().setDate(new Date().getDate() - 1));

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("yesterday");
    });

    test("should return the expected duration in 'hour'", () => {
      // GIVEN a date 1 hour ago
      const givenDate = new Date(new Date().getTime() - 1 * 60 * 60 * 1000);

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("1 hour ago");
    });

    test("should return the expected duration in 'minute'", () => {
      // GIVEN a date 1 minute ago
      const givenDate = new Date(new Date().getTime() - 1 * 60 * 1000);

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("1 minute ago");
    });
  });

  describe("durations above a week", () => {
    test("should return the formatted date when the duration is more than a week", () => {
      // GIVEN a date 10 days ago
      const givenDate = new Date(new Date().setDate(new Date().getDate() - 10));

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe(`on ${givenDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}`);
    });

    test("should return the formatted date when the duration is more than a month", () => {
      // GIVEN a date 30 days ago
      const givenDate = new Date(new Date().setDate(new Date().getDate() - 30));

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe(`on ${givenDate.toLocaleDateString("en-GB", { timeZone: "UTC" })}`);
    });
  });

  describe("invalid dates", () => {
    test("should return 'just now' when the dates are the same", () => {
      // GIVEN the current date
      const givenDate = new Date();

      // WHEN getDurationFromNow is called with the given date
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("just now");
    });

    test("should log a warning when the given date is in the future", () => {
      // GIVEN a date in the future
      const givenDate = new Date(new Date().getTime() + 10000);

      // WHEN getDurationFromNow is called with the given date
      getDurationFromNow(givenDate);
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
      const result = getDurationFromNow(givenDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("on 10/10/2021");
    });
  });
});
