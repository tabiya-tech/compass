import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { getRestAPIErrorFactory, RestAPIError, getUserFriendlyErrorMessageKey, translateUserFriendlyErrorMessage } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import i18n from "src/i18n/i18n";

describe("Test the RestAPIError class", () => {
  it.each([
    ["string", "some string"],
    [
      "ErrorAPISpecs.Types.Payload",
      {
        errorCode: ErrorConstants.ErrorCodes.INTERNAL_SERVER_ERROR,
        message: "message",
        details: "details",
      },
    ],
    ["object", { foo: "bar" } as object],
    ["undefined", undefined],
    ["null", null],
  ])("should create a RestAPIError object with %s details", (description, causeValue) => {
    // GIVEN a service name, function, method, path, status code, error code, message and details as string
    const givenServiceName = "service";
    const givenServiceFunction = "function";
    const givenMethod = "method";
    const givenPath = "path";
    const givenStatusCode = 400;
    const givenErrorCode = ErrorConstants.ErrorCodes.API_ERROR;
    const givenMessage = "message";
    const givenCause = causeValue;

    // WHEN creating a RestAPIError object
    const actual = new RestAPIError(
      givenServiceName,
      givenServiceFunction,
      givenMethod,
      givenPath,
      givenStatusCode,
      givenErrorCode,
      givenMessage,
      givenCause
    );
    // THEN the object should be created
    expect(actual).toBeDefined();
    // AND the object should be an instance of RestAPIError
    expect(actual).toBeInstanceOf(RestAPIError);
    // AND the object should be an instance of Error
    expect(actual).toBeInstanceOf(Error);
    // AND the object should have the given parameters
    expect(actual.serviceName).toBe(givenServiceName);
    expect(actual.serviceFunction).toBe(givenServiceFunction);
    expect(actual.method).toBe(givenMethod);
    expect(actual.path).toBe(givenPath);
    expect(actual.statusCode).toBe(givenStatusCode);
    expect(actual.errorCode).toBe(givenErrorCode);
    expect(actual.message).toBe(`RestAPIError: ${givenMessage}`);
    expect(actual.cause).toBe(givenCause);
  });
});

describe("Test the getRestAPIErrorFactory function", () => {
  it("should return a RestAPIErrorFactory", () => {
    // GIVEN a service name, function, method and path
    const givenServiceName = "service";
    const givenServiceFunction = "function";
    const givenMethod = "method";
    const givenPath = "path";

    // WHEN calling getRestAPIErrorFactory
    const errorFactory = getRestAPIErrorFactory("service", "function", "method", "path");

    // THEN the function should return a RestAPIErrorFactory
    expect(errorFactory).toBeDefined();
    expect(errorFactory).toBeInstanceOf(Function);
    // AND the RestAPIErrorFactory should return a RestAPIError
    const givenStatusCode = 400;
    const givenErrorCode = ErrorConstants.ErrorCodes.API_ERROR;
    const givenMessage = "message";
    const givenCause = "cause";
    const actualError = errorFactory(givenStatusCode, givenErrorCode, givenMessage, givenCause);
    // AND the RestAPIError should have the given parameters
    expect(actualError.serviceName).toBe(givenServiceName);
    expect(actualError.serviceFunction).toBe(givenServiceFunction);
    expect(actualError.method).toBe(givenMethod);
    expect(actualError.path).toBe(givenPath);
    expect(actualError.statusCode).toBe(givenStatusCode);
    expect(actualError.errorCode).toBe(givenErrorCode);
    expect(actualError.message).toBe(`RestAPIError: ${givenMessage}`);
    expect(actualError.cause).toBe(givenCause);
  });
});

describe("Test the getUserFriendlyErrorMessage function", () => {
  it("should return UNEXPECTED_ERROR for non-RestAPIError errors", () => {
    // GIVEN a random error
    const error = new Error("Random error");
    // WHEN calling getUserFriendlyErrorMessage
    const key = getUserFriendlyErrorMessageKey(error);
    expect(key).toBe("UNEXPECTED_ERROR");
    const message = translateUserFriendlyErrorMessage(key);
    expect(message).toBe(i18n.t(ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS.UNEXPECTED_ERROR));
  });

  describe("ErrorConstants.ErrorCodes", () => {
    describe("should return correct message for 'API_ERROR' error code", () => {
      test.each([
        [0, "UNEXPECTED_ERROR"],
        [StatusCodes.MULTIPLE_CHOICES, "UNABLE_TO_PROCESS_RESPONSE"],
        [StatusCodes.BAD_REQUEST, "DATA_VALIDATION_ERROR"],
        [StatusCodes.UNAUTHORIZED, "AUTHENTICATION_FAILURE"],
        [StatusCodes.FORBIDDEN, "PERMISSION_DENIED"],
        [StatusCodes.NOT_FOUND, "RESOURCE_NOT_FOUND"],
        [StatusCodes.REQUEST_TOO_LONG, "REQUEST_TOO_LONG"],
        [StatusCodes.TOO_MANY_REQUESTS, "TOO_MANY_REQUESTS"],
        [StatusCodes.INTERNAL_SERVER_ERROR, "UNEXPECTED_ERROR"],
        [StatusCodes.BAD_GATEWAY, "SERVICE_UNAVAILABLE"],
        [StatusCodes.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE"],
      ])("%s Status Code", (statusCode, expectedKey) => {
        // GIVEN an API RestAPIError with the given error code
        const error = new RestAPIError(
          "service",
          "function",
          "method",
          "path",
          statusCode,
          ErrorConstants.ErrorCodes.API_ERROR,
          "Failed to fetch models",
          "Failed to fetch models"
        );
        // WHEN calling getUserFriendlyErrorMessage
        const key = getUserFriendlyErrorMessageKey(error);
        expect(key).toBe(expectedKey);
        const message = translateUserFriendlyErrorMessage(key);
        expect(message).toBe(i18n.t(ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS[expectedKey as keyof typeof ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS]));
      });
    });

    test.each([
      [ErrorConstants.ErrorCodes.FAILED_TO_FETCH, "SERVER_CONNECTION_ERROR"],
      [ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "UNABLE_TO_PROCESS_RESPONSE"],
      [ErrorConstants.ErrorCodes.INVALID_RESPONSE_HEADER, "UNABLE_TO_PROCESS_RESPONSE"],
      [ErrorConstants.ErrorCodes.FORBIDDEN, "UNEXPECTED_ERROR"],
      ["(none of the above)", "UNEXPECTED_ERROR"],
    ])("Should return correct message for '%s' error code", (errorCode, expectedKey) => {
      // GIVEN a RestAPIError with the given error code
      const error = new RestAPIError(
        "service",
        "function",
        "method",
        "path",
        0,
        errorCode as ErrorConstants.ErrorCodes,
        "Failed to fetch models",
        "Failed to fetch models"
      );
      // WHEN calling getUserFriendlyErrorMessage
      const key = getUserFriendlyErrorMessageKey(error);
      expect(key).toBe(expectedKey);
      const message = translateUserFriendlyErrorMessage(key);
      expect(message).toBe(i18n.t(ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS[expectedKey as keyof typeof ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS]));
    });

    test("Should return correct message for 'FORBIDDEN' error code and status is 422", () => {
      // GIVEN Error with 'FORBIDDEN' error code and status code 422
      const error = new RestAPIError(
        "service",
        "function",
        "method",
        "path",
        422,
        ErrorConstants.ErrorCodes.FORBIDDEN,
        "Failed to fetch models",
        "Failed to fetch models"
      );

      // WHEN calling getUserFriendlyErrorMessage
      const key = getUserFriendlyErrorMessageKey(error);
      expect(key).toBe("UNABLE_TO_PROCESS_REQUEST");
      const message = translateUserFriendlyErrorMessage(key);
      expect(message).toBe(i18n.t(ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS.UNABLE_TO_PROCESS_REQUEST));
    });
  });
});
