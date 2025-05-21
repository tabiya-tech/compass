/**
 * A utility function to pause execution for a specified duration.
 *
 * @param delay - MS to wait before resolving the promise.
 */
export const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

/**
 * Calculates the backoff duration based on the current attempt number.
 */
export const getNextBackoff = (initial_backoff_ms: number, attempt: number): number => {
  if (attempt <= 1) return 0;
  return initial_backoff_ms * 2 ** (attempt - 2);
};
