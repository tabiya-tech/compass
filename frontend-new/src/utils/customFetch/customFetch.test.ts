// Mute Chatty Console.
import "src/_test_utilities/consoleMock";

import { customFetch } from "./customFetch";
import { setupFetchSpy } from "src/_test_utilities/fetchSpy";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import * as UtilsModule from "src/utils/customFetch/utils";
import { StatusCodes } from "http-status-codes";
import { MAX_ATTEMPTS, RETRY_STATUS_CODES } from "./constants";

// Mock the dynamic import
jest.mock("src/auth/services/Authentication.service.factory", () => ({
  __esModule: true,
  default: {
    getCurrentAuthenticationService: jest.fn().mockReturnValue({
      refreshToken: jest.fn(),
    }),
  },
}));

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

    // AND the server responds with a 200 status code
    setupFetchSpy(200, "fetch response", "application/json;charset=UTF-8");

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
    expect(response.status).toBe(200);
  });

  test("fetchWithAuth should not add Authorization header when authRequired is false", async () => {
    // GIVEN an API URL and authRequired is false
    const givenApiUrl = "givenAPIUrl";
    const givenServiceName = "Some service";
    const givenServiceFunction = "Some function";
    const givenMethod = "GET";
    const givenFailureMessage = "fetchWithAuth failed";

    // AND the server responds with a 200 status code
    setupFetchSpy(200, "fetch response", "application/json;charset=UTF-8");

    // WHEN fetchWithAuth is called with authRequired set to false
    const response = await customFetch(givenApiUrl, {
      expectedStatusCode: 200,
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
    expect(response.status).toBe(200);
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

    // AND the server responds with a 200 status code
    setupFetchSpy(200, "fetch response", "application/json;charset=UTF-8");

    // WHEN fetchWithAuth is called with authRequired set to true
    const response = await customFetch(givenApiUrl, {
      expectedStatusCode: 200,
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
    expect(response.status).toBe(200);
  });

  test("fetchWithAuth should still send the request without an Authorization header when authToken is not found in the storage", async () => {
    // GIVEN an API URL and no auth token in sessionStorage
    const givenApiUrl = "givenAPIUrl";

    jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(null);

    // AND the server responds with a 200 status code
    setupFetchSpy(200, "fetch response", "application/json;charset=UTF-8");

    // WHEN fetchWithAuth is called with an apiUrl
    await expect(customFetch(givenApiUrl)).rejects.toThrow("RestAPIError: No token available for authentication");

    // THEN expect fetch to have been called without the Authorization header
    expect(global.fetch).not.toHaveBeenCalled();
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

    // AND the server responds with a 404 status code
    setupFetchSpy(404, "Not Found", "application/json;charset=UTF-8");

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration
    let error: Error | undefined;
    try {
      await customFetch(givenApiUrl, {
        expectedStatusCode: 200,
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

    // AND the server responds with an XML response
    // @ts-ignore
    setupFetchSpy(200, "fetch response", "application/xml;charset=UTF-8");

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration
    let error: Error | undefined;
    try {
      await customFetch(givenApiUrl, {
        expectedStatusCode: 200,
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
    expect(error?.message).toBe("RestAPIError: Response Content-Type should be 'application/json'");
    expect(error as RestAPIError).toMatchObject({
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      path: givenApiUrl,
      statusCode: 200,
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
    setupFetchSpy(200, "fetch response", "application/xml;charset=UTF-8");

    // WHEN fetchWithAuth is called with an apiUrl and an init configuration
    const response = await customFetch(givenApiUrl, {
      expectedStatusCode: 200,
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      failureMessage: givenFailureMessage,
    });

    // THEN expect the response to be the expected response
    expect(response.status).toBe(200);
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
        expectedStatusCode: 200,
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

  describe("Token refresh functionality", () => {
    test("should refresh token and retry request when receiving 401", async () => {
      // GIVEN an API URL and a valid auth token
      const givenApiUrl = "givenAPIUrl";
      const givenToken = "oldToken";
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

      // AND the server first responds with 401, then with 200
      const mockFetch = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(new Response("Unauthorized", { status: StatusCodes.UNAUTHORIZED }))
        .mockResolvedValueOnce(new Response("Success", { status: StatusCodes.OK }));

      // AND the auth service factory is mocked to return a service that can refresh the token
      const mockAuthService = {
        refreshToken: jest.fn().mockResolvedValue(undefined),
      };
      (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

      // WHEN fetchWithAuth is called
      const response = await customFetch(givenApiUrl, {
        expectedStatusCode: 200,
        serviceName: givenServiceName,
        serviceFunction: givenServiceFunction,
        method: givenMethod,
        failureMessage: givenFailureMessage,
        authRequired: true,
      });

      // THEN the auth service should be called to refresh the token
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

      // AND the final response should be successful
      expect(response.status).toBe(StatusCodes.OK);
    });

    test("should throw error if token refresh fails", async () => {
      // GIVEN an API URL and a valid auth token
      const givenApiUrl = "givenAPIUrl";
      const givenToken = "oldToken";
      const givenServiceName = "Some service";
      const givenServiceFunction = "Some function";
      const givenMethod = "GET";
      const givenFailureMessage = "fetchWithAuth failed";

      // AND the auth token is initially set
      jest.spyOn(AuthenticationStateService.getInstance(), "getToken").mockReturnValueOnce(givenToken);

      // AND the auth service factory is mocked to return a service that fails to refresh the token
      const mockAuthService = {
        refreshToken: jest.fn().mockRejectedValue(new Error("Token refresh failed")),
      };
      (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue(mockAuthService);

      // WHEN fetchWithAuth is called
      let error: Error | undefined;
      try {
        await customFetch(givenApiUrl, {
          expectedStatusCode: 200,
          serviceName: givenServiceName,
          serviceFunction: givenServiceFunction,
          method: givenMethod,
          failureMessage: givenFailureMessage,
          authRequired: true,
        });
      } catch (e) {
        error = e as Error;
      }

      // THEN an error should be thrown
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(RestAPIError);
      expect(error?.message).toBe(`RestAPIError: ${givenFailureMessage}`);
    });

    test("should not attempt token refresh if auth is not required", async () => {
      // GIVEN an API URL and auth is not required
      const givenApiUrl = "givenAPIUrl";
      const givenServiceName = "Some service";
      const givenServiceFunction = "Some function";
      const givenMethod = "GET";
      const givenFailureMessage = "fetchWithAuth failed";

      // WHEN fetchWithAuth is called with authRequired set to false
      let error: Error | undefined;
      try {
        await customFetch(givenApiUrl, {
          expectedStatusCode: 200,
          serviceName: givenServiceName,
          serviceFunction: givenServiceFunction,
          method: givenMethod,
          failureMessage: givenFailureMessage,
          authRequired: false,
        });
      } catch (e) {
        error = e as Error;
      }

      // THEN the auth service should not be called to refresh the token
      expect(AuthenticationServiceFactory.getCurrentAuthenticationService).not.toHaveBeenCalled();

      // AND an error should be thrown
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(RestAPIError);
      expect(error?.message).toBe(`RestAPIError: ${givenFailureMessage}`);
    });
  });

  describe("Retry tests", () => {
    test.each(RETRY_STATUS_CODES)("should retry requests when receiving %s", async (statusCode) => {
      // GIVEN an API URL and a valid auth token in sessionStorage
      const givenApiUrl = "givenAPIUrl";
      const givenServiceName = "Some service";
      const givenServiceFunction = "Some function";
      const givenMethod = "GET";
      const givenFailureMessage = "fetchWithAuth failed";

      // AND the server responds with the given status code
      setupFetchSpy(statusCode, "Error", "application/json;charset=UTF-8");

      const sleepSpy = jest.spyOn(UtilsModule, "sleep").mockImplementation(() => Promise.resolve());

      // WHEN fetchWithAuth is called with an apiUrl and an init configuration.
      const fetchPromise = customFetch(givenApiUrl, {
        expectedStatusCode: 200,
        serviceName: givenServiceName,
        serviceFunction: givenServiceFunction,
        method: givenMethod,
        failureMessage: givenFailureMessage,
        authRequired: false,
      });

      // THEN the function will reject
      await expect(fetchPromise).rejects.toThrow();

      // AND the fetch should be called 4 times (1 initial + 3 retries)
      expect(global.fetch).toHaveBeenCalledTimes(MAX_ATTEMPTS);

      // AND the sleepSpy should be called for each retry
      expect(sleepSpy).toHaveBeenCalledTimes(MAX_ATTEMPTS - 1); // (1) because the first attempt does not sleep.

      expect(sleepSpy).toHaveBeenNthCalledWith(1, 500); // Initial backoff
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 1000); // First retry backoff
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 2000); // Second retry backoff
    });
  });

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
      expectedStatusCode: 200,
      serviceName: givenServiceName,
      serviceFunction: givenServiceFunction,
      method: givenMethod,
      failureMessage: givenFailureMessage,
      authRequired: false,
    });

    // THEN the function will reject
    await expect(fetchPromise).rejects.toThrow("RestAPIError: fetchWithAuth failed");
  });
});
