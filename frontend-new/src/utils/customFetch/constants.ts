import { StatusCodes } from "http-status-codes";

// Status codes that should trigger a retry
// We are certain that these status codes are temporary issues and can be retried,
// and also there has been not change in the state of the resource.
// For any other status code, do not retry the request. It should be handled by the caller.
export const RETRY_STATUS_CODES = [
  StatusCodes.TOO_MANY_REQUESTS, // 429
  StatusCodes.BAD_GATEWAY, // 502
  StatusCodes.SERVICE_UNAVAILABLE, // 503
];

export const INITIAL_BACKOFF_MS = 500; // Start with half a second

// Number of attempts to be made.
export const MAX_ATTEMPTS = 4;
