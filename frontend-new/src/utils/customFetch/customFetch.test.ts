// Mute Chatty Console.
import "src/_test_utilities/consoleMock";

import {
  customFetch,
  ExtendedRequestInit,
  MAX_ATTEMPTS,
  MIN_TOKEN_VALIDITY_SECONDS,
  RETRY_STATUS_CODES,
} from "./customFetch";
import { setupFetchSpy } from "src/_test_utilities/fetchSpy";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import * as UtilsModule from "src/utils/customFetch/utils";
import { StatusCodes } from "http-status-codes";
import { TokenValidationFailureCause } from "src/auth/services/Authentication.service";

// Mock the dynamic import
jest.mock("src/auth/services/Authentication.service.factory", () => ({
  __esModule: true,
  default: {
    getCurrentAuthenticationService: jest.fn().mockReturnValue({
      refreshToken: jest.fn(),
      isTokenValid: jest.fn().mockReturnValue({
        decodedToken: { exp: Math.floor(Date.now() / 1000) + 3600 }, // valid token by default
        failureCause: null,
      }),
    }),
  },
}));

const VALID_TOKEN_RESPONSE = {
  decodedToken: { exp: Math.floor(Date.now() / 1000) + 3600 }, // valid token by default
  isValid: true,
  failureCause: null,
};

describe("Api Service tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAllMethodMocks(AuthenticationStateService.getInstance());
  });

  test("fetchWithAuth should add Authorization header when authToken is present", async () => {
    // GIVEN an API URL and a valid auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";
    const givenToken = "someAuthToken";

    jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenToken);

    // AND the token is valid.
    const mockAuthService = {
      isTokenValid: jest.fn().mockReturnValue(VALID_TOKEN_RESPONSE),
    };
    (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

    // AND the server responds with a StatusCodes.OK status code
    setupFetchSpy(StatusCodes.OK, "fetch response", "application/json;charset=UTF-8");

    // WHEN fetchWithAuth is called with an api url
    const response = await customFetch(givenApiUrl);

    // THEN expect fetch to have been called with the correct arguments
    expect(global.fetch).toHaveBeenCalledWith(
      givenApiUrl,
      expect.objectContaining({
        headers: {
          map:
            expect.any(Headers) &&
            expect.objectContaining({
              authorization: `Bearer ${givenToken}`,
            }),
        },
      })
    );
    // AND expect the response to be the expected response
    expect(response.status).toBe(StatusCodes.OK);
  });

  test("fetchWithAuth should not add Authorization header when authRequired is false", async () => {
    // GIVEN an API URL and authRequired is false
    const givenApiUrl = "givenAPIUrl";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    // AND the server responds with a StatusCodes.OK status code
    setupFetchSpy(StatusCodes.OK, "fetch response", "application/json;charset=UTF-8");

    // WHEN fetchWithAuth is called with authRequired set to false
    const response = await customFetch(givenApiUrl, {
      expectedStatusCode: StatusCodes.OK,
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      failureMessage: givenFailureMessage,
      authRequired: false,
    });

    // THEN expect fetch to have been called without the Authorization header
    expect(global.fetch).toHaveBeenCalledWith(
      givenApiUrl,
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      })
    );
    // AND expect the response to be the expected response
    expect(response.status).toBe(StatusCodes.OK);
  });

  test("fetchWithAuth should add Authorization header when authRequired is true and token is present", async () => {
    // GIVEN an API URL and a valid auth token
    const givenApiUrl = "givenAPIUrl";
    const givenToken = "someAuthToken";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenToken);

    // AND the server responds with a StatusCodes.OK status code
    setupFetchSpy(StatusCodes.OK, "fetch response", "application/json;charset=UTF-8");

    // WHEN fetchWithAuth is called with authRequired set to true
    const response = await customFetch(givenApiUrl, {
      expectedStatusCode: StatusCodes.OK,
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      failureMessage: givenFailureMessage,
      authRequired: true,
    });

    // THEN expect fetch to have been called with the Authorization header
    expect(global.fetch).toHaveBeenCalledWith(
      givenApiUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          map: expect.objectContaining({
            authorization: `Bearer ${givenToken}`,
          }),
        }),
      })
    );
    // AND expect the response to be the expected response
    expect(response.status).toBe(StatusCodes.OK);
  });

  test("fetchWithAuth should fail if authRequired: true and no token in storage", async () => {
    // GIVEN an API URL and no auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";
    jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(null);

    const globalFetchSpy = jest.spyOn(global, "fetch");

    // AND given init request.
    const givenFailureMessage = "fetchWithAuth failed";
    const request: ExtendedRequestInit = {
      authRequired: true,
      serviceName: "GivenService",
      failureMessage: givenFailureMessage,
      serviceFunction: "givenServiceFunction",
      expectedStatusCode: [StatusCodes.OK],
      expectedContentType: "application/json",
    };

    // WHEN fetchWithAuth is called with an apiUrl
    await expect(customFetch(givenApiUrl, request)).rejects.toThrow(`RestAPIError: ${givenFailureMessage}`);

    // THEN expect fetch to have been called without the Authorization header
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });

  test("fetchWithAuth should throw an error if the server responds with an unexpected status code", async () => {
    // GIVEN an API URL and a valid auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";
    const givenAuthToken = "someAuthToken";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenAuthToken);

    // AND the auth service factory is mocked to return a service that validates tokens
    const mockAuthService = {
      isTokenValid: jest.fn().mockReturnValue(VALID_TOKEN_RESPONSE),
    };
    (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

    // AND the server responds with a 404 status code
    setupFetchSpy(404, "Not Found", "application/json;charset=UTF-8");

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration
    let error: Error | undefined;
    try {
      await customFetch(givenApiUrl, {
        expectedStatusCode: StatusCodes.OK,
        serviceName: givenServiceName,
        serviceFunction: givenServiceFunction,
        method: givenMethod,
        failureMessage: givenFailureMessage,
      });
    } catch (e) {
      error = e as Error;
    }

    // THEN expect an error to have been thrown
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(RestAPIError);
    expect(error?.message).toBe(`RestAPIError: ${givenFailureMessage}`);
    expect(error as RestAPIError).toMatchObject({
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      path: givenApiUrl,
      statusCode: 404,
      errorCode: ErrorConstants.ErrorCodes.API_ERROR,
      cause: "Not Found",
    });
  });

  test("fetchWithAuth should throw an error if the server responds with an unexpected Content-Type", async () => {
    // GIVEN an API URL and a valid auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";
    const givenAuthToken = "someAuthToken";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenAuthToken);

    // AND the auth service factory is mocked to return a service that validates tokens
    const mockAuthService = {
      isTokenValid: jest.fn().mockReturnValue(VALID_TOKEN_RESPONSE),
    };
    (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

    // AND the server responds with an XML response
    // @ts-ignore
    setupFetchSpy(StatusCodes.OK, "fetch response", "application/xml;charset=UTF-8");

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration
    let error: Error | undefined;
    try {
      await customFetch(givenApiUrl, {
        expectedStatusCode: StatusCodes.OK,
        serviceName: givenServiceName,
        serviceFunction: givenServiceFunction,
        method: givenMethod,
        failureMessage: givenFailureMessage,
        expectedContentType: "application/json", // This is the expected Content-Type
      });
    } catch (e) {
      error = e as Error;
    }

    // THEN expect an error to have been thrown
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(RestAPIError);
    expect(error?.message).toBe(`RestAPIError: Response Content-Type should be 'application/json'`);
    expect(error as RestAPIError).toMatchObject({
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      path: givenApiUrl,
      statusCode: StatusCodes.OK,
      errorCode: "INVALID_RESPONSE_HEADER",
      cause: "Content-Type header was application/xml;charset=UTF-8",
    });
  });

  test("fetchWithAuth should allow all Content-Types if expectedContentType is not provided", async () => {
    // GIVEN an API URL and a valid auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";
    const givenAuthToken = "someAuthToken";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenAuthToken);

    // AND the server responds with an XML response
    // @ts-ignore
    setupFetchSpy(StatusCodes.OK, "fetch response", "application/xml;charset=UTF-8");

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration
    const response = await customFetch(givenApiUrl, {
      expectedStatusCode: StatusCodes.OK,
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      failureMessage: givenFailureMessage,
    });

    // THEN expect the response to be the expected response
    expect(response.status).toBe(StatusCodes.OK);
  });

  test("fetchWithAuth should throw an error if the fetch fails", async () => {
    // GIVEN an API URL and a valid auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";
    const givenAuthToken = "someAuthToken";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenAuthToken);

    // AND fetch fails
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Failed to fetch"));

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration
    let error: Error | undefined;
    try {
      await customFetch(givenApiUrl, {
        expectedStatusCode: StatusCodes.OK,
        serviceName: givenServiceName,
        serviceFunction: givenServiceFunction,
        method: givenMethod,
        failureMessage: givenFailureMessage,
      });
    } catch (e) {
      error = e as Error;
    }

    // THEN expect an error to have been thrown
    expect(error).toBeDefined();
    expect(error?.message).toBe(`RestAPIError: ${givenFailureMessage}`);
  });

  describe("Retry tests", () => {
    test.each(RETRY_STATUS_CODES)("should retry requests when receiving %s", async (statusCode) => {
      // GIVEN an API URL and a valid auth token in sessionStorage
      const givenApiUrl = "givenAPIUrl";
      const givenServiceName = "Some service";
      const givenServiceFunction = "Some function";
      const givenMethod = "GET";
      const givenFailureMessage = "fetchWithAuth failed";

      // AND the server always responds with the given status code
      const mockFetch = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(
          new Response("Error", { status: statusCode, headers: { "Content-Type": "application/json;charset=UTF-8" } })
        );

      const sleepSpy = jest.spyOn(UtilsModule, "sleep").mockImplementation(() => Promise.resolve());

      // WHEN fetchWithAuth is called with an apiUrl and an init configuration.
      const fetchPromise = customFetch(givenApiUrl, {
        expectedStatusCode: StatusCodes.OK,
        serviceName: givenServiceName,
        serviceFunction: givenServiceFunction,
        method: givenMethod,
        failureMessage: givenFailureMessage,
        authRequired: false,
      });

      // THEN the function will reject
      await expect(fetchPromise).rejects.toThrow();

      // AND the fetch should be called MAX_ATTEMPTS times
      expect(mockFetch).toHaveBeenCalledTimes(MAX_ATTEMPTS);

      // AND the sleepSpy should be called for each retry
      expect(sleepSpy).toHaveBeenCalledTimes(MAX_ATTEMPTS);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000); // Initial backoff
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000); // First retry backoff
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000); // Second retry backoff
      expect(sleepSpy).toHaveBeenNthCalledWith(4, 8000); // Third retry backoff
    });

    test.each([StatusCodes.NO_CONTENT, StatusCodes.NOT_FOUND, StatusCodes.INTERNAL_SERVER_ERROR])(
      "should retry when the given status code %s is provided as part retriable status codes",
      async (statusCode) => {
        // GIVEN an API URL and a valid auth token in sessionStorage.
        const givenApiUrl = "givenAPIUrl";
        const givenServiceName = "Some service";
        const givenServiceFunction = "Some function";
        const givenMethod = "GET";
        const givenFailureMessage = "fetchWithAuth failed";
        const givenExpectedStatusCode = StatusCodes.OK;

        // AND the server will fail for the first three attempts and succeed on the fourth.
        const failureResponse = new Response("Error", {
          status: statusCode,
          headers: { "Content-Type": "application/json;charset=UTF-8" },
        });
        const successResponse = new Response("Success", {
          status: givenExpectedStatusCode,
          headers: { "Content-Type": "application/json;charset=UTF-8" },
        });

        const mockFetch = jest
          .spyOn(global, "fetch")
          .mockResolvedValueOnce(failureResponse) // First attempt fails
          .mockResolvedValueOnce(failureResponse) // Second attempt fails
          .mockResolvedValueOnce(failureResponse) // Third attempt fails
          .mockResolvedValueOnce(successResponse); // Fourth attempt succeeds

        const sleepSpy = jest.spyOn(UtilsModule, "sleep").mockImplementation(() => Promise.resolve());

        // WHEN fetchWithAuth is called with an apiUrl and an init configuration.
        const fetchPromise = customFetch(givenApiUrl, {
          expectedStatusCode: givenExpectedStatusCode,
          serviceName: givenServiceName,
          serviceFunction: givenServiceFunction,
          method: givenMethod,
          failureMessage: givenFailureMessage,
          retriableStatusCodes: [statusCode],
          authRequired: false,
        });

        // THEN promise will resolve at the end.
        await expect(fetchPromise).resolves.toBe(successResponse); // The final response should be the success response

        // AND the fetch should be called MAX_ATTEMPTS times
        expect(mockFetch).toHaveBeenCalledTimes(MAX_ATTEMPTS);

        // AND the sleepSpy should be called for each retry
        expect(sleepSpy).toHaveBeenCalledTimes(MAX_ATTEMPTS - 1); // No sleep before the first attempt

        expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000); // Initial backoff
        expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000); // First retry backoff
        expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000); // Second retry backoff
      }
    );
  });

  test("should retry on fail to fetch if the caller has requested it", async () => {
    // GIVEN an API URL and a valid auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    // AND the server responds with the given status code
    const windowFetch = setupFetchSpy(500, {}, "");
    windowFetch
      .mockRejectedValue(new TypeError("failed to fetch"));

    jest.spyOn(UtilsModule, "sleep").mockImplementation(() => Promise.resolve());

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration.
    const fetchPromise = customFetch(givenApiUrl, {
      expectedStatusCode: StatusCodes.OK,
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      failureMessage: givenFailureMessage,
      authRequired: false,
      retryOnFailedToFetch: true
    });

    // THEN the function will reject
    await expect(fetchPromise).rejects.toThrow(`RestAPIError: ${givenFailureMessage}`);

    // AND the fetch should be called MAX_ATTEMPTS times
    expect(windowFetch).toHaveBeenCalledTimes(MAX_ATTEMPTS);

    // AND the sleepSpy should be called for each retry
    expect(UtilsModule.sleep).toHaveBeenCalledTimes(MAX_ATTEMPTS); // No sleep before the first attempt

    expect(UtilsModule.sleep).toHaveBeenNthCalledWith(1, 1000); // Initial backoff
    expect(UtilsModule.sleep).toHaveBeenNthCalledWith(2, 2000); // First retry backoff
    expect(UtilsModule.sleep).toHaveBeenNthCalledWith(3, 4000); // Second retry backoff
    expect(UtilsModule.sleep).toHaveBeenNthCalledWith(4, 8000); // Third retry backoff
  })

  test("should fail if fetch fails to go through", async () => {
    // GIVEN an API URL and a valid auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    // AND the server responds with the given status code
    const windowFetch = setupFetchSpy(500, {}, "");
    windowFetch.mockRejectedValueOnce(new TypeError("failed to fetch"));

    jest.spyOn(UtilsModule, "sleep").mockImplementation(() => Promise.resolve());

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration.
    const fetchPromise = customFetch(givenApiUrl, {
      expectedStatusCode: StatusCodes.OK,
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      failureMessage: givenFailureMessage,
      authRequired: false,
      retryOnFailedToFetch: true,
    });

    // THEN the function will reject
    await expect(fetchPromise).rejects.toThrow(`RestAPIError: ${givenFailureMessage}`);
  });

  describe("Token validation and refresh", () => {
    test("should validate token before making request if the token is invalid", async () => {
      // GIVEN an API URL and an invalid token
      const givenApiUrl = "givenAPIUrl";
      const givenToken = "invalidToken";
      const givenServiceName = "Some service";
      const givenServiceFunction = "Some function";
      const givenMethod = "GET";
      const givenFailureMessage = "fetchWithAuth failed";

      // AND the token validation service returns an invalid token response
      const givenInvalidTokenResponse = {
        decodedToken: null,
        failureCause: "INVALID_TOKEN",
      };

      // AND the auth token is set
      jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenToken);

      // AND the auth service factory is mocked to return a service that validates tokens
      const mockAuthService = {
        isTokenValid: jest.fn().mockReturnValue(givenInvalidTokenResponse),
        refreshToken: jest.fn(),
      };
      (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

      // AND fetch is mocked
      const mockFetch = jest.spyOn(global, "fetch");

      // WHEN fetchWithAuth is called
      await expect(
        customFetch(givenApiUrl, {
          expectedStatusCode: StatusCodes.OK,
          serviceName: givenServiceName,
          serviceFunction: givenServiceFunction,
          method: givenMethod,
          failureMessage: givenFailureMessage,
          authRequired: true,
        })
      ).rejects.toThrow();

      // THEN isTokenValid should be called with the token
      expect(mockAuthService.isTokenValid).toHaveBeenCalledWith(givenToken);
      // AND fetch should not be called because the token is invalid
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test.each([MIN_TOKEN_VALIDITY_SECONDS - 1, MIN_TOKEN_VALIDITY_SECONDS - 10])(
      "should refresh token if it's about to expire",
      async (tokenExpirySeconds) => {
        // GIVEN an API URL and a token that's about to expire
        const givenApiUrl = "givenAPIUrl";
        const givenToken = "expiringToken";
        const givenNewToken = "newToken";
        const givenServiceName = "Some service";
        const givenServiceFunction = "Some function";
        const givenMethod = "GET";
        const givenFailureMessage = "fetchWithAuth failed";

        // AND the auth token is initially set
        jest
          .spyOn(AuthenticationStateService.getInstance(), "getToken")
          .mockReturnValueOnce(givenToken)
          .mockReturnValueOnce(givenNewToken);

        // AND the auth service factory is mocked to return a service that validates tokens
        const mockAuthService = {
          isTokenValid: jest
            .fn()
            .mockReturnValueOnce({
              isValid: true,
              decodedToken: { exp: Math.floor(Date.now() / 1000) + tokenExpirySeconds }, // token about to expire
              failureCause: null,
            })
            .mockReturnValueOnce({
              isValid: true,
              decodedToken: { exp: Math.floor(Date.now() / 1000) + 3600 }, // new token valid for an hour
              failureCause: null,
            }),
          refreshToken: jest.fn().mockResolvedValue(undefined),
        };
        (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

        // AND the server responds with a StatusCodes.OK status code
        const mockFetch = setupFetchSpy(StatusCodes.OK, "Success", "application/json;charset=UTF-8");

        // WHEN fetchWithAuth is called
        const response = await customFetch(givenApiUrl, {
          expectedStatusCode: StatusCodes.OK,
          serviceName: givenServiceName,
          serviceFunction: givenServiceFunction,
          method: givenMethod,
          failureMessage: givenFailureMessage,
          authRequired: true,
        });

        // THEN the token should be refreshed
        expect(mockAuthService.refreshToken).toHaveBeenCalled();
        // AND the request should be made with the new token
        expect(mockFetch).toHaveBeenCalledWith(
          givenApiUrl,
          expect.objectContaining({
            headers: expect.objectContaining({
              map: expect.objectContaining({
                authorization: `Bearer ${givenNewToken}`,
              }),
            }),
          })
        );
        // AND the response should be successful
        expect(response.status).toBe(StatusCodes.OK);
      }
    );

    test.each([MIN_TOKEN_VALIDITY_SECONDS + 1, MIN_TOKEN_VALIDITY_SECONDS + 10])(
      "should not refresh token if it's not about to expire",
      async (tokenExpirySeconds) => {
        // GIVEN an API URL and a token that's not about to expire
        const givenApiUrl = "givenAPIUrl";
        const givenToken = "validToken";
        const givenServiceName = "Some service";
        const givenServiceFunction = "Some function";
        const givenMethod = "GET";
        const givenFailureMessage = "fetchWithAuth failed";

        // AND the auth token is set
        jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenToken);

        // AND the auth service factory is mocked to return a service that validates tokens
        const mockAuthService = {
          isTokenValid: jest.fn().mockReturnValue({
            isValid: true,
            decodedToken: { exp: Math.floor(Date.now() / 1000) + tokenExpirySeconds }, // token not about to expire
            failureCause: null,
          }),
          refreshToken: jest.fn(),
        };
        (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

        // AND the server responds with a StatusCodes.OK status code
        const mockFetch = setupFetchSpy(StatusCodes.OK, "Success", "application/json;charset=UTF-8");

        // WHEN fetchWithAuth is called
        const response = await customFetch(givenApiUrl, {
          expectedStatusCode: StatusCodes.OK,
          serviceName: givenServiceName,
          serviceFunction: givenServiceFunction,
          method: givenMethod,
          failureMessage: givenFailureMessage,
          authRequired: true,
        });

        // THEN the token should not be refreshed
        expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
        // AND the request should be made with the original token
        expect(mockFetch).toHaveBeenCalledWith(
          givenApiUrl,
          expect.objectContaining({
            headers: expect.objectContaining({
              map: expect.objectContaining({
                authorization: `Bearer ${givenToken}`,
              }),
            }),
          })
        );
        // AND the response should be successful
        expect(response.status).toBe(StatusCodes.OK);
      }
    );

    test("should refresh token when receiving 401 with expired token", async () => {
      // GIVEN an API URL and an expired token
      const givenApiUrl = "givenAPIUrl";
      const givenToken = "expiredToken";
      const givenNewToken = "newToken";
      const givenServiceName = "Some service";
      const givenServiceFunction = "Some function";
      const givenMethod = "GET";
      const givenFailureMessage = "fetchWithAuth failed";

      // AND the auth token is initially set and then gets refreshed
      jest
        .spyOn(AuthenticationStateService.getInstance(), "getToken")
        .mockReturnValueOnce(givenToken)
        .mockReturnValueOnce(givenNewToken)
        .mockReturnValueOnce(givenNewToken);

      // AND the auth service factory is mocked to return a service that validates tokens
      //  should show valid token on first call (so that the initial request will be made),
      //  expired token on second call (the token has expired since initial call was made)
      //  and valid token on third call (the token has been refreshed)
      const mockAuthService = {
        isTokenValid: jest
          .fn()
          .mockReturnValueOnce({
            isValid: true,
            decodedToken: { exp: Math.floor(Date.now() / 1000) + 3600 }, // valid
            failureCause: null,
          })
          .mockReturnValueOnce({
            isValid: false,
            decodedToken: { exp: Math.floor(Date.now() / 1000) - 1 }, // expired
            failureCause: TokenValidationFailureCause.TOKEN_EXPIRED,
          })
          .mockReturnValueOnce({
            isValid: true,
            decodedToken: { exp: Math.floor(Date.now() / 1000) + 3600 }, // valid
            failureCause: null,
          }),
        refreshToken: jest.fn().mockResolvedValue(undefined),
      };
      (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

      // AND the server first responds with 401, then with StatusCodes.OK
      const mockFetch = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(new Response("Unauthorized", { status: StatusCodes.UNAUTHORIZED }))
        .mockResolvedValueOnce(new Response("Success", { status: StatusCodes.OK }));

      // WHEN fetchWithAuth is called
      const response = await customFetch(givenApiUrl, {
        expectedStatusCode: StatusCodes.OK,
        serviceName: givenServiceName,
        serviceFunction: givenServiceFunction,
        method: givenMethod,
        failureMessage: givenFailureMessage,
        authRequired: true,
      });

      // THEN the token should be refreshed
      expect(mockAuthService.refreshToken).toHaveBeenCalled();
      // AND the request should be retried with the new token
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        givenApiUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            map: expect.objectContaining({
              authorization: `Bearer ${givenNewToken}`,
            }),
          }),
        })
      );
      // AND the response should be successful
      expect(response.status).toBe(StatusCodes.OK);
    });

    test("should not refresh token when receiving 401 with valid token", async () => {
      // GIVEN an API URL and a valid token
      const givenApiUrl = "givenAPIUrl";
      const givenToken = "validToken";
      const givenServiceName = "Some service";
      const givenServiceFunction = "Some function";
      const givenMethod = "GET";
      const givenFailureMessage = "fetchWithAuth failed";

      // AND the auth token is set
      jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenToken);

      // AND the auth service factory is mocked to return a service that validates tokens
      const mockAuthService = {
        isTokenValid: jest.fn().mockReturnValue({
          decodedToken: { exp: Math.floor(Date.now() / 1000) + 3600 }, // valid
          failureCause: null,
        }),
        refreshToken: jest.fn(),
      };
      (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

      // AND the server responds with 401
      setupFetchSpy(StatusCodes.UNAUTHORIZED, "Unauthorized", "application/json;charset=UTF-8");

      // WHEN fetchWithAuth is called
      let error: Error | undefined;
      try {
        await customFetch(givenApiUrl, {
          expectedStatusCode: StatusCodes.OK,
          serviceName: givenServiceName,
          serviceFunction: givenServiceFunction,
          method: givenMethod,
          failureMessage: givenFailureMessage,
          authRequired: true,
        });
      } catch (e) {
        error = e as Error;
      }

      // THEN the token should not be refreshed
      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
      // AND an error should be thrown
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(RestAPIError);
      expect(error?.message).toBe(`RestAPIError: ${givenFailureMessage}`);
    });
  });
});
