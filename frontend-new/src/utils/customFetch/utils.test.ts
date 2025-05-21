import { sleep } from "./utils";

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
