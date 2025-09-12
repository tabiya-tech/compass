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
/**
 * Calculates the time remaining until a token expires.
 * @return {number} The time remaining in seconds until the token expires.
 * if token is already expired, can return negative value.
 * */
export const calculateTimeToTokenExpiry = (exp: number): number => {
  // exp is in unix timestamp format (seconds since epoch)
  const currentTime = Math.floor(Date.now() / 1000); // current time in seconds
  return exp - currentTime; // time to expiry in seconds
}
/**
 * Calculates the percentage gain from compression.
 *
 * @param originalSize - The original size before compression.
 * @param compressedSize - The size after compression.
 */
export const calculateCompressionGainPercent = (originalSize: number, compressedSize: number): number => {
  if (originalSize === 0) return 0;
  return ((originalSize - compressedSize) / originalSize) * 100;
}
