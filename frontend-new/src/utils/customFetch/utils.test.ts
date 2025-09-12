import { calculateCompressionGainPercent, calculateTimeToTokenExpiry, getNextBackoff, sleep } from "./utils";

describe("sleep", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each([0, 100, 100, 5000, 10000])("should resolve after the specified delay", async (delay) => {
    // GIVEN a delay value
    // WHEN we call the sleep function with that delay.
    const sleepPromise = sleep(delay);

    // AND the timers are advanced by the delay
    jest.advanceTimersByTime(delay);

    // THEN the promise should resolve
    await expect(sleepPromise).resolves.toBeUndefined();
  });

  it("should not resolve before the specified delay", async () => {
    // GIVEN a delay value
    const delay = 2000;

    // AND a short delay to check before the full delay
    const shortDelay = 500;

    // WHEN we call the sleep function with that delay
    let resolved = false;
    sleep(delay).then(() => {
      resolved = true;
    });

    // AND we advance the timers by a short delay
    jest.advanceTimersByTime(shortDelay);

    // THEN The promise should not have resolved yet.
    // We need to await a microtask to allow promise resolution (or lack thereof) to settle.
    await Promise.resolve(); // Flushes the microtask queue

    // AND check if the promise is still pending
    expect(resolved).toBe(false);

    // WHEN we advance the timers by the remaining time
    jest.advanceTimersByTime(delay - shortDelay);

    // THEN the promise should resolve
    await Promise.resolve(); // Flush microtask queue again
    // AND check if the promise has resolved.
    expect(resolved).toBe(true);
  });
});

describe("getNextBackoff", () => {
  it.each([
    [1000, 1, 0],
    [1000, 2, 1000],
    [1000, 3, 2000],
    [1000, 4, 4000],
    [500, 2, 500],
    [500, 3, 1000],
  ])("should calculate correct backoff for initial_backoff_ms=%i and attempt=%i", (initialBackoff, attempt, expected) => {
    // GIVEN initial backoff and attempt values
    // WHEN we calculate the next backoff
    const result = getNextBackoff(initialBackoff, attempt);
    // THEN it should return the expected value
    expect(result).toBe(expected);
  });
});

describe("calculateTimeToTokenExpiry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should return correct time remaining for future expiry", () => {
    // GIVEN a future expiry time (1 hour from now)
    const currentTime = Math.floor(Date.now() / 1000);
    const futureExpiry = currentTime + 3600; // 1 hour in the future

    // WHEN we calculate time to expiry
    const result = calculateTimeToTokenExpiry(futureExpiry);

    // THEN it should return approximately 3600 seconds
    expect(result).toBeCloseTo(3600, -1); // Allow for small timing differences
  });

  it("should return negative value for expired token", () => {
    // GIVEN a past expiry time (1 hour ago)
    const currentTime = Math.floor(Date.now() / 1000);
    const pastExpiry = currentTime - 3600; // 1 hour in the past

    // WHEN we calculate time to expiry
    const result = calculateTimeToTokenExpiry(pastExpiry);

    // THEN it should return a negative value
    expect(result).toBeLessThan(0);
  });

  it("should return 0 for token expiring now", () => {
    // GIVEN current time as expiry
    const currentTime = Math.floor(Date.now() / 1000);

    // WHEN we calculate time to expiry
    const result = calculateTimeToTokenExpiry(currentTime);

    // THEN it should return approximately 0
    expect(result).toBeCloseTo(0, -1); // Allow for small timing differences
  });
});

describe("calculateCompressionGainPercent", () => {
  test.each([
    [50, 1000, 500],
    [75, 1000, 250],
    [5, 1000, 950],
    [0, 1000, 1000],
    [0, 0, 0],
    [-100, 1000, 2000]
  ])("should return %i% for originalSize=%i and compressedSize=%i", (expected, originalSize, compressedSize) => {
    // GIVEN original and compressed sizes
    // WHEN we calculate the compression gain percent
    const actualResult = calculateCompressionGainPercent(originalSize, compressedSize);
    // THEN it should return the expected value
    expect(actualResult).toBe(expected);
  });
});
