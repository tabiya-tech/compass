import { formatTokenForLogging } from "./formatTokenForLogging";

describe("formatTokenForLogging", () => {
  const createValidToken = () => "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

  it("should mask the middle portion of a valid token", () => {
    // GIVEN a valid JWT token
    const token = createValidToken();

    // WHEN formatting the token for logging
    const result = formatTokenForLogging(token);

    // THEN it should return a masked version with only the first and last 6 characters visible
    expect(result).toMatch(/^012345.*UVWXYZ$/);
    expect(result.length).toBeLessThan(token.length);
  });

  describe("edge cases", () => {
    it("should handle null token", () => {
      // WHEN formatting a null token
      //@ts-ignore
      const result = formatTokenForLogging(null);

      // THEN it should return a placeholder string
      expect(result).toBe("<no token>");
    });

    it("should handle undefined token", () => {
      // WHEN formatting an undefined token
      //@ts-ignore
      const result = formatTokenForLogging(undefined);

      // THEN it should return a placeholder string
      expect(result).toBe("<no token>");
    });

    it("should handle empty string token", () => {
      // WHEN formatting an empty string token
      const result = formatTokenForLogging("");

      // THEN it should return a placeholder string
      expect(result).toBe("<no token>");
    });

    it("should handle very short tokens", () => {
      // WHEN formatting a token shorter than the masking length
      const result = formatTokenForLogging("abc");

      // THEN it should return the token as is
      expect(result).toBe("abc");
    });

    it("should handle whitespace-only token", () => {
      // WHEN formatting a whitespace token
      const result = formatTokenForLogging("   ");

      // THEN it should return a placeholder string
      expect(result).toBe("<empty token>");
    });
  });
});
