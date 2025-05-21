import { StatusCodes } from "http-status-codes";
import { AuthenticationError } from "src/error/commonErrors";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";

import { sleep, getNextBackoff } from "./utils";
import { INITIAL_BACKOFF_MS, MAX_ATTEMPTS, RETRY_STATUS_CODES } from "./constants";

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
};

export const defaultInit: ExtendedRequestInit = {
  expectedStatusCode: StatusCodes.OK,
  serviceName: "Unknown service",
  serviceFunction: "Unknown method",
  failureMessage: "Unknown error",
  authRequired: true,
};

export const customFetch = async (apiUrl: string, init: ExtendedRequestInit = defaultInit): Promise<Response> => {
  const { serviceName, serviceFunction, failureMessage, authRequired = true, expectedStatusCode, ...options } = init;

  // check if the expected status code is an array or a single value
  const expectedStatusCodes = Array.isArray(expectedStatusCode) ? expectedStatusCode : [expectedStatusCode];

  // By default, fetch will use the GET HTTP method.
  // We are using it also to get the error factory function so that we can use it later in the code.
  // REF: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#setting_the_method

  const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, init.method ?? "GET", apiUrl);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // If it is not the first attempt, before fetching, sleep for some time that exponentially increases
    // Based on the attempt number.
    if (attempt > 1) {
      const backOffMs = getNextBackoff(INITIAL_BACKOFF_MS, attempt);
      await sleep(backOffMs);
    }

    let token = authRequired ? AuthenticationStateService.getInstance().getToken() : null;

    // GUARD: If auth is required but no token is available, throw an error.
    if (authRequired && !token) {
      throw errorFactory(0, ErrorConstants.ErrorCodes.API_ERROR, "No token available for authentication", null);
    }

    let response: Response;
    try {
      const headers = new Headers(init.headers || {});

      // if auth is required(and token is available), add the Authorization header.
      if (authRequired) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const enhancedInit = { ...options, headers };

      response = await fetch(apiUrl, enhancedInit);
    } catch (e: any) {
      // If the fetch fails (e.g. network error), throw an error.
      // We do not know if the operation was successful or not, and if the server was able to process the request or not.
      // Let the caller decide what to do with this error.
      throw errorFactory(0, ErrorConstants.ErrorCodes.FAILED_TO_FETCH, failureMessage, e);
    }

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

      return response;
    } else if (authRequired && response.status === StatusCodes.UNAUTHORIZED) {
      // import the Authentication service factory dynamically to avoid circular dependencies.
      // If the response status is 401 Unauthorized, try to refresh the token.
      const authServiceFactory = await import("src/auth/services/Authentication.service.factory");
      const authService = authServiceFactory.default.getCurrentAuthenticationService();
      if (!authService) {
        console.warn(
          `customFetch: No authentication service available for ${serviceName}.${serviceFunction} on attempt ${attempt}.`
        );
        throw new AuthenticationError("No authentication service available");
      }

      try {
        await authService.refreshToken();
      } catch (e: any) {
        console.warn(
          `customFetch: Failed to refresh token for ${serviceName}.${serviceFunction} on attempt ${attempt}.`,
          e
        );
        throw errorFactory(0, ErrorConstants.ErrorCodes.API_ERROR, failureMessage, e);
      }
      // Retry the request with the new token
      continue;
    } else if (RETRY_STATUS_CODES.includes(response.status)) {
      // The response status is in the list of retryable status codes,
      continue;
    }

    // Server responded with a status code that indicates that the resource was not the expected one
    const responseBody = await response.text();
    throw errorFactory(response.status, ErrorConstants.ErrorCodes.API_ERROR, failureMessage, responseBody);
  }
  console.warn(
    `customFetch: Reached max attempts (${MAX_ATTEMPTS}) for ${serviceName}.${serviceFunction} without success.`
  );
  throw errorFactory(0, ErrorConstants.ErrorCodes.API_ERROR, failureMessage, null);
};
