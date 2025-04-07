import { StatusCodes } from "http-status-codes";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";

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
};
export const customFetch = async (
  apiUrl: string,
  init: ExtendedRequestInit = {
    expectedStatusCode: StatusCodes.OK,
    serviceName: "Unknown service",
    serviceFunction: "Unknown method",
    failureMessage: "Unknown error",
  }
): Promise<Response> => {
  const { serviceName, serviceFunction, failureMessage, ...options } = init;

  // check if the expected status code is an array or a single value
  const expectedStatusCodes = Array.isArray(init.expectedStatusCode)
    ? init.expectedStatusCode
    : [init.expectedStatusCode];

  const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, init.method ?? "Unknown method", apiUrl);
  let response: Response;
  const token = AuthenticationStateService.getInstance().getToken()

  try {
    const headers = new Headers(init.headers || {});
    // if no token available, add it to the headers
    if (token) {
      headers.append("Authorization", `Bearer ${token}`);
    }

    const enhancedInit = { ...options, headers };

    response = await fetch(apiUrl, enhancedInit);
  } catch (e: any) {
    throw errorFactory(0, ErrorConstants.ErrorCodes.FAILED_TO_FETCH, failureMessage, e);
  }
  // check if the server responded with the expected status code
  if (!expectedStatusCodes.includes(response.status)) {
    // Server responded with a status code that indicates that the resource was not the expected one
    // The responseBody should be an ErrorResponse but that is not guaranteed e.g. if a gateway in the middle returns a 502,
    // or if the server is not conforming to the error response schema
    const responseBody = await response.text();
    throw errorFactory(response.status, ErrorConstants.ErrorCodes.API_ERROR, failureMessage, responseBody);
  }
  // check if the response is in the expected format
  const responseContentType = response.headers.get("Content-Type");
  // @ts-ignore
  if (init.expectedContentType && !responseContentType?.includes(init.expectedContentType)) {
    throw errorFactory(
      response.status,
      ErrorConstants.ErrorCodes.INVALID_RESPONSE_HEADER,
      "Response Content-Type should be 'application/json'",
      `Content-Type header was ${responseContentType}`
    );
  }
  return response;
};
