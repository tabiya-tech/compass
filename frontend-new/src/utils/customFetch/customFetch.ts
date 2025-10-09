import { enqueueSnackbar } from "notistack";
import { AuthenticationError, TokenError } from "src/error/commonErrors";
import { getRestAPIErrorFactory, RestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import i18n from "src/i18n/i18n";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";

import { calculateCompressionGainPercent, calculateTimeToTokenExpiry, getNextBackoff, sleep } from "./utils";
import { TokenValidationFailureCause } from "src/auth/services/Authentication.service";

import { StatusCodes } from "http-status-codes";
import { routerPaths } from "src/app/routerPaths";
import brotliPromise from "brotli-wasm";

// Status codes that should trigger a retry
// We are certain that these status codes are temporary issues and can be retried,
// and also there has been not change in the state of the resource.
// For any other status code, do not retry the request. It should be handled by the caller.
export const RETRY_STATUS_CODES = [
  StatusCodes.TOO_MANY_REQUESTS, // 429
  StatusCodes.BAD_GATEWAY, // 502
  StatusCodes.SERVICE_UNAVAILABLE, // 503
];
// this, in conjunction with the max attempts, will mean that the maximum wait time for retries will be
// 1st call  = 0s backoff
// 2nd call  = 1s backoff
// 3rd call  = 2s backoff
// 4th call  = 4s backoff
// 5th call  = 8s backoff
// with a total of 15 seconds of wait time before we give up and throw an error.
export const INITIAL_BACKOFF_MS = 1000; // Start with a second

// Number of attempts to be made.
export const MAX_ATTEMPTS = 4;

// threshold for minimum time the token should be valid for
// if the token is valid for less than this time, it will be refreshed
export const MIN_TOKEN_VALIDITY_SECONDS = 30; // 30 sec

// Duration to be waited by the snackbar telling you you have been logged out.
// It is 10 seconds twice of the default one
export const LOGGED_OUT_SNACKBAR_AUTO_HIDE_DURATION = 10000;

// Minimum performance gain percentage to consider compression
// Otherwise it is not worth the CPU cost of compressing and decompressing
export const MIN_PERFORMANCE_GAIN_PERCENT = 5;

// This function is used to make authenticated fetch requests
// It adds the Authorization header with the Token from the session storage
// It also checks if the response is in the expected format
// It throws an error if the response is not in the expected format
// It throws an error if the server responds with a status code that is not among the expected one.
// A function can expect multiple status codes by passing an array of status codes to the expectedStatusCode field
export type ExtendedRequestInit = RequestInit & {
  expectedStatusCode: number | number[];
  serviceName: string;
  serviceFunction: string;
  failureMessage: string;
  expectedContentType?: string;
  authRequired?: boolean;

  // If the customFetch should retry the request on the provided status codes.
  retriableStatusCodes?: number[];

  // If the customFetch should retry the request on didn't fetch errors.
  retryOnFailedToFetch?: boolean;

  compressRequestBody?: boolean;
};

export const defaultInit: ExtendedRequestInit = {
  expectedStatusCode: StatusCodes.OK,
  serviceName: "Unknown service",
  serviceFunction: "Unknown method",
  failureMessage: "Unknown error",
  authRequired: true,
  compressRequestBody: true,
};

class CustomFetchError extends Error {
  constructor(
    message: string,
    public attempt: number,
    cause: unknown = null
  ) {
    super(message, { cause });
    this.name = "CustomFetchError";
  }
}

/*
 * Refresh the token using the authentication service.
 * */
const refreshToken = async (
  attempt: number,
  serviceName: string,
  serviceFunction: string,
  failureMessage: string,
  errorFactory: RestAPIErrorFactory
): Promise<string> => {
  // import the Authentication service factory dynamically to avoid circular dependencies.
  // If the response status is 401 Unauthorized, try to refresh the token.
  const authServiceFactory = await import("src/auth/services/Authentication.service.factory");
  const authService = authServiceFactory.default.getCurrentAuthenticationService();
  if (!authService) {
    throw new AuthenticationError(
      `customFetch: No authentication service available for (${serviceName}.${serviceFunction}) on attempt: ${attempt}.`
    );
  }

  const isProviderSessionValid = await authService.isProviderSessionValid();

  if (!isProviderSessionValid) {
    const userFriendlyErrorMessage = i18n.t(
      ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS.AUTHENTICATION_FAILURE,
    );
    await authService.logout();
    enqueueSnackbar(`${userFriendlyErrorMessage} We are logging you out ....`, {
      autoHideDuration: LOGGED_OUT_SNACKBAR_AUTO_HIDE_DURATION,
      variant: "error",
    });

    // Redirect to the landing page
    // We are using window.location.href instead of React router's useNavigate hook.
    // Because the React router requires to be in a React component to use to navigate function.
    // Or the navigate function should be chained from a React component all the way here.
    // It is not extendable and not maintainable.
    // So we are using window.location.href to redirect to the landing page.
    window.location.href = `/#${routerPaths.LANDING}`;

    throw new AuthenticationError("Authentication provider session is not valid/available. Logging out user.");
  }

  try {
    await authService.refreshToken();
    const newToken = AuthenticationStateService.getInstance().getToken();
    if (newToken && authService.isTokenValid(newToken).isValid) {
      console.info(`customFetch: Token refreshed successfully for ${serviceName}.${serviceFunction} on attempt ${attempt}.`);
    }

    if (!newToken) {
      throw new AuthenticationError(
        `customFetch: No token available after refreshing for ${serviceName}.${serviceFunction} on attempt ${attempt}.`
      );
    }

    return newToken;
  } catch (e: any) {
    const error = new CustomFetchError(
      `customFetch: Failed to refresh token for ${serviceName}.${serviceFunction}.`,
      attempt,
      e
    );

    throw errorFactory(0, ErrorConstants.ErrorCodes.API_ERROR, failureMessage, error);
  }
};

/*
 * Check if the token is valid before making the request.
 * If the token is otherwise valid, but expired or about to be expired, try to refresh it.
 * if the token is invalid, throw an error.
 * */
const checkToken = async (
  token: string | null,
  attempt: number,
  serviceName: string,
  serviceFunction: string,
  errorFactory: RestAPIErrorFactory
) => {
  if (!token) {
    const cause = new CustomFetchError(
      `customFetch: No token available for ${serviceName}.${serviceFunction}.`,
      attempt
    );
    throw errorFactory(0, ErrorConstants.ErrorCodes.API_ERROR, "No token available for authentication", cause);
  }

  // import the Authentication service factory dynamically to avoid circular dependencies.
  // If the response status is 401 Unauthorized, try to refresh the token.
  const authServiceFactory = await import("src/auth/services/Authentication.service.factory");
  const authService = authServiceFactory.default.getCurrentAuthenticationService();
  if (!authService) {
    const cause = new CustomFetchError(
      `customFetch: No authentication service available for ${serviceName}.${serviceFunction}.`,
      attempt
    );
    throw new AuthenticationError("No authentication service available for authentication", cause);
  }

  const { isValid, failureCause, decodedToken } = authService.isTokenValid(token);

  // If the token is valid, we are certain that the decodedToken is not null.
  // That is why we are using the non-null assertion operator (!).
  if (isValid && calculateTimeToTokenExpiry(decodedToken!.exp) < MIN_TOKEN_VALIDITY_SECONDS) {
    console.debug(
      "customFetch: Token is valid but about to expire, refreshing token for",
      serviceName,
      serviceFunction
    );
    throw new TokenError(TokenValidationFailureCause.TOKEN_EXPIRED);
  }

  // if the token is invalid, and the reason is that it is expired try to refresh it.
  if (failureCause === TokenValidationFailureCause.TOKEN_EXPIRED) {
    console.debug(`customFetch: Token is expired for ${serviceName}.${serviceFunction} on attempt ${attempt}.`);
    // throw a specific error if the token is expired so that the caller can handle it specifically.
    throw new TokenError(TokenValidationFailureCause.TOKEN_EXPIRED);
  }

  // if the token is valid, return without throwing an error.
  if (isValid) {
    return;
  }

  // Otherwise, if the token is invalid for any other reason, throw an error.
  const cause = new CustomFetchError(
    `customFetch: Token is invalid for ${serviceName}.${serviceFunction}. Failure cause: ${failureCause}`,
    attempt
  );
  throw new AuthenticationError(`Token is invalid: ${failureCause}`, cause);
};

export const customFetch = async (apiUrl: string, init: ExtendedRequestInit = defaultInit): Promise<Response> => {
  const {
    serviceName,
    serviceFunction,
    failureMessage,
    authRequired = true,
    expectedStatusCode,
    retriableStatusCodes = [],
    retryOnFailedToFetch = false,
    compressRequestBody = true,
    ...options
  } = init;

  // check if the expected status code is an array or a single value
  const expectedStatusCodes = Array.isArray(expectedStatusCode) ? expectedStatusCode : [expectedStatusCode];

  // By default, fetch will use the GET HTTP method.
  // We are using it also to get the error factory function so that we can use it later in the code.
  // REF: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#setting_the_method

  const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, init.method ?? "GET", apiUrl);
  let failedDueToRetryableStatusCode = 1;

  // Collect retry warnings instead of logging each one individually
  const attemptErrors: Error[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let token = authRequired ? AuthenticationStateService.getInstance().getToken() : null;

    // GUARD: If auth is required then check the token validity.
    // invalid token will throw an error. a valid token will be used to make the request.
    if (authRequired) {
      try {
        await checkToken(token, attempt, serviceName, serviceFunction, errorFactory);
        // if checking the token is successful, continue to the request.
      } catch (e) {
        if ((e as TokenError).message === TokenValidationFailureCause.TOKEN_EXPIRED) {
          // If the token is expired, try to refresh it.
          token = await refreshToken(attempt, serviceName, serviceFunction, failureMessage, errorFactory);
          // After refreshing the token continue to the request
        } else {
          // if checking token fails for any other reason, do nothing and let the error be thrown.
          throw errorFactory(0, ErrorConstants.ErrorCodes.API_ERROR, failureMessage, e as Error);
        }
      }
    }

    let response: Response;
    try {
      const headers = new Headers(init.headers || {});

      // if auth is required(and token is available), add the Authorization header.
      if (authRequired) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      let processedBody = options.body;

      // Handle request body compression
      if (compressRequestBody && options.body) {
        // Skip compression for FormData, File objects, and multipart content types
        const contentType = headers.get("Content-Type") || "";
        const isFormData = options.body instanceof FormData;
        const isFile = options.body instanceof File;
        const isMultipart = contentType.includes("multipart/");

        if (isFormData || isFile || isMultipart) {
          console.debug(
            `Skipping compression for ${serviceName}.${serviceFunction} because the body is a FormData, File, or multipart content type`
          );
          processedBody = options.body;
        } else {
          // Convert body to string if needed
          const bodyString = typeof options.body === "string" ? options.body : JSON.stringify(options.body);

          // Set Content-Type for JSON if not already set
          if (!headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
          }

          try {
            let rawBytes = new TextEncoder().encode(bodyString);

            const brotli = await brotliPromise;
            let compressedBytes = brotli.compress(rawBytes);

            // First, check if we want to compress based on the throughput gain. (if it is less than MIN_PERFORMANCE_GAIN_PERCENT, do not compress)
            // This is to avoid the CPU overhead of compressing and decompressing small payloads.
            const performanceGainPercent = calculateCompressionGainPercent(rawBytes.length, compressedBytes.length);
            if (performanceGainPercent < MIN_PERFORMANCE_GAIN_PERCENT) {
              console.debug(
                `Skipping compression for ${serviceName}.${serviceFunction} because the gain is below the threshold. Body size: ${rawBytes.length}, gain: ${performanceGainPercent}`
              );
              processedBody = bodyString;
              headers.delete("Content-Encoding");
            } else {
              console.debug(`Compressing request for ${serviceName}.${serviceFunction} with body size ${rawBytes.length}, gain: ${performanceGainPercent}`);
              // Copy to a fresh ArrayBuffer to satisfy BlobPart typing (avoid SharedArrayBuffer)
              const ab = new ArrayBuffer(compressedBytes.byteLength);
              new Uint8Array(ab).set(compressedBytes);
              processedBody = new Blob([ab]);
              headers.set("Content-Encoding", "br");
            }
          } catch (error) {
            console.warn(`Failed to compress request for ${serviceName}.${serviceFunction}:`, error);
            processedBody = bodyString;
            headers.delete("Content-Encoding");
          }
        }
      }

      const enhancedInit = {
        ...options,
        headers,
        body: processedBody,
      };

      response = await fetch(apiUrl, enhancedInit);
    } catch (e: any) {
      // If the caller, has set the retryOnFailedToFetch to true, and the fetch fails due to a network error,
      // We should sleep for some time and retry the request.
      if (retryOnFailedToFetch) {
        // Instead of logging immediately, add to grouped attemptErrors
        const error = new CustomFetchError(
          `Attempt ${attempt}: Failed to fetch ${serviceName}.${serviceFunction}`,
          attempt,
          e
        );
        console.debug(error);
        attemptErrors.push(error);

        const backOffMs = getNextBackoff(INITIAL_BACKOFF_MS, attempt + 1);
        console.debug(
          "sleeping for",
          backOffMs,
          "ms before retrying",
          serviceName,
          serviceFunction,
          "attempt",
          attempt
        );
        await sleep(backOffMs);

        continue; // Retry the request
      }

      // If the fetch fails (e.g. network error), throw an error.
      // We do not know if the operation was successful or not, and if the server was able to process the request or not.
      // Let the caller decide what to do with this error.
      throw errorFactory(0, ErrorConstants.ErrorCodes.FAILED_TO_FETCH, failureMessage, e);
    }

    // Combine the default retriable status codes with the ones provided by the caller.
    const combinedRetriableStatusCodes = [...RETRY_STATUS_CODES, ...retriableStatusCodes];

    // If the expectedStatusCodes includes the response status.
    // Validate the content type if the expectedContentType is provided.
    // And then return the response because this is a successful response.
    if (expectedStatusCodes.includes(response.status)) {
      const responseContentType = response.headers.get("Content-Type");
      if (init.expectedContentType && !responseContentType?.includes(init.expectedContentType)) {
        throw errorFactory(
          response.status,
          ErrorConstants.ErrorCodes.INVALID_RESPONSE_HEADER,
          `Response Content-Type should be '${init.expectedContentType}'`,
          `Content-Type header was ${responseContentType}`
        );
      }

      // if there were any warnings, we log them grouped together
      if (attemptErrors.length > 0) {
        console.warn(
          new CustomFetchError(
            `customFetch: ${serviceName}.${serviceFunction} succeeded after ${attempt} attempts.`,
            attempt,
            attemptErrors
          )
        );
      }

      return response;
    } else if (authRequired && response.status === StatusCodes.UNAUTHORIZED) {
      try {
        await checkToken(token, attempt, serviceName, serviceFunction, errorFactory);
        // If the token is valid, but the response is still 401 Unauthorized,
        // it means that the 401 isnt about the token, but about the user not being authorized to access the resource.
        // do nothing and let the error be thrown.
      } catch (e) {
        if ((e as TokenError).message === TokenValidationFailureCause.TOKEN_EXPIRED) {
          // If the token is expired, try to refresh it.
          await refreshToken(attempt, serviceName, serviceFunction, failureMessage, errorFactory);
          // After refreshing the token, retry the request.
          continue;
        } else {
          // if checking token fails for any other reason, do nothing and let the error be thrown.
        }
      }
    } else if (combinedRetriableStatusCodes.includes(response.status)) {
      // Instead of logging immediately, add to grouped attemptErrors
      const error = new CustomFetchError(
        `Attempt ${attempt}: Got retriable status ${response.status} from ${serviceName}.${serviceFunction}`,
        attempt
      );
      console.debug(error);
      attemptErrors.push(error);

      // The response status is in the list of combined retryable status codes,
      // If it is not the first attempt, before fetching, sleep for some time that exponentially increases
      // Based on the attempt number.
      failedDueToRetryableStatusCode++;
      const backOffMs = getNextBackoff(INITIAL_BACKOFF_MS, failedDueToRetryableStatusCode);
      console.info("sleeping for", backOffMs, "ms before retrying", serviceName, serviceFunction, "attempt", attempt);
      await sleep(backOffMs);
      continue;
    }

    // Server responded with a status code that indicates that the resource was not the expected one
    const responseBody = await response.text();
    throw errorFactory(response.status, ErrorConstants.ErrorCodes.API_ERROR, failureMessage, responseBody);
  }

  // if all attempts failed, we log them grouped together
  const cause = new CustomFetchError(
    `customFetch: Reached max attempts (${MAX_ATTEMPTS}) for ${serviceName}.${serviceFunction} without success.`,
    MAX_ATTEMPTS,
    attemptErrors
  );
  throw errorFactory(0, ErrorConstants.ErrorCodes.API_ERROR, failureMessage, cause);
};
