import { getDurationBetweenDates } from "./getDurationBetweenDates";

describe("getDurationBetweenDates", () => {
  describe("plural dates", () => {
    test("should return the expected duration in days", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10");
      const givenSecondDate = new Date("2021-10-20");

      // WHEN getDurationBetweenDates is called with the given dates
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 days ago");
    });

    test("should return the expected duration in hours", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10T10:00:00");
      const givenSecondDate = new Date("2021-10-10T20:00:00");

      // WHEN getDurationBetweenDates is called with the given dates
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 hours ago");
    });

    test("should return the expected duration in minutes", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10T10:00:00");
      const givenSecondDate = new Date("2021-10-10T10:10:00");

      // WHEN getDurationBetweenDates is called with the given dates
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 minutes ago");
    });

    test("should return the expected duration in days, hours and minutes", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10T10:00:00");
      const givenSecondDate = new Date("2021-10-20T20:10:10");

      // WHEN getDurationBetweenDates is called with the given dates
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 days 10 hours 10 minutes ago");
    });
  });

  describe("singular dates", () => {
    test("should return yesterday when the duration is 1 day", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10");
      const givenSecondDate = new Date("2021-10-11");

      // WHEN getDurationBetweenDates is called with the given dates
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("yesterday");
    });

    test("should return the expected duration in 'hour'", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10T10:00:00");
      const givenSecondDate = new Date("2021-10-10T11:00:00");

      // WHEN getDurationBetweenDates is called with the given dates
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("1 hour ago");
    });

    test("should return the expected duration in 'minute'", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10T10:00:00");
      const givenSecondDate = new Date("2021-10-10T10:01:00");

      // WHEN getDurationBetweenDates is called with the given dates
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("1 minute ago");
    });
  });

  describe("invalid dates", () => {
    test("should return 0 seconds when the dates are the same", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10");
      const givenSecondDate = new Date("2021-10-10");

      // WHEN getDurationBetweenDates is called with the given dates
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("just now");
    });
    test("should return the expected failure message when the first date is after the second date", () => {
      // GIVEN two dates
      const givenFirstDate = new Date("2021-10-10");
      const givenSecondDate = new Date("2021-10-09");

      // WHEN getDurationBetweenDates is called with the given dates
      // THEN expect an error to be thrown
      expect(() => getDurationBetweenDates(givenFirstDate, givenSecondDate)).toThrowError(
        "Invalid date range: First date must be before second date"
      );
    });
    test("should return the expected result when the dates are strings", () => {
      // GIVEN two dates
      const givenFirstDate = "2021-10-10";
      const givenSecondDate = "2021-10-20";

      // WHEN getDurationBetweenDates is called with the given dates
      // @ts-ignore
      const result = getDurationBetweenDates(givenFirstDate, givenSecondDate);

      // THEN expect the expected duration to be returned
      expect(result).toBe("10 days ago");
    });
  });
});
