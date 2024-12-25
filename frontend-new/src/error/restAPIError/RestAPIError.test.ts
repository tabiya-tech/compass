import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import {
  getRestAPIErrorFactory,
  RestAPIError,
  getUserFriendlyErrorMessage,
} from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";

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
  ])("should create a RestAPIError object with %s details", (description, detailsValue) => {
    // GIVEN a service name, function, method, path, status code, error code, message and details as string
    const givenServiceName = "service";
    const givenServiceFunction = "function";
    const givenMethod = "method";
    const givenPath = "path";
    const givenStatusCode = 400;
    const givenErrorCode = ErrorConstants.ErrorCodes.API_ERROR;
    const givenMessage = "message";
    const givenDetails = detailsValue;

    // WHEN creating a RestAPIError object
    const actual = new RestAPIError(
      givenServiceName,
      givenServiceFunction,
      givenMethod,
      givenPath,
      givenStatusCode,
      givenErrorCode,
      givenMessage,
      givenDetails
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
    expect(actual.message).toBe(givenMessage);
    expect(actual.details).toBe(givenDetails);
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
    const givenDetails = "details";
    const actualError = errorFactory(givenStatusCode, givenErrorCode, givenMessage, givenDetails);
    // AND the RestAPIError should have the given parameters
    expect(actualError.serviceName).toBe(givenServiceName);
    expect(actualError.serviceFunction).toBe(givenServiceFunction);
    expect(actualError.method).toBe(givenMethod);
    expect(actualError.path).toBe(givenPath);
    expect(actualError.statusCode).toBe(givenStatusCode);
    expect(actualError.errorCode).toBe(givenErrorCode);
    expect(actualError.message).toBe(givenMessage);
    expect(actualError.details).toBe(givenDetails);
  });
});

describe("Test the getUserFriendlyErrorMessage function", () => {
  it("should return UNEXPECTED_ERROR for non-RestAPIError errors", () => {
    // GIVEN a random error
    const error = new Error("Random error");
    // WHEN calling getUserFriendlyErrorMessage
    const message = getUserFriendlyErrorMessage(error);
    // THEN the function should return a generic error message
    expect(message).toBe(ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNEXPECTED_ERROR);
  });

  describe("ErrorConstants.ErrorCodes", () => {
    describe("should return correct message for 'API_ERROR' error code", () => {
      test.each([
        [0, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNEXPECTED_ERROR],
        [StatusCodes.MULTIPLE_CHOICES, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNABLE_TO_PROCESS_RESPONSE],
        [StatusCodes.BAD_REQUEST, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.DATA_VALIDATION_ERROR],
        [StatusCodes.UNAUTHORIZED, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.AUTHENTICATION_FAILURE],
        [StatusCodes.FORBIDDEN, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.PERMISSION_DENIED],
        [StatusCodes.NOT_FOUND, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.RESOURCE_NOT_FOUND],
        [StatusCodes.REQUEST_TOO_LONG, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.REQUEST_TOO_LONG],
        [StatusCodes.TOO_MANY_REQUESTS, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.TOO_MANY_REQUESTS],
        [StatusCodes.INTERNAL_SERVER_ERROR, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNEXPECTED_ERROR],
        [StatusCodes.BAD_GATEWAY, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.SERVICE_UNAVAILABLE],
        [StatusCodes.SERVICE_UNAVAILABLE, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.SERVICE_UNAVAILABLE],
      ])("%s Status Code", (statusCode, expectedMessage) => {
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
        const message = getUserFriendlyErrorMessage(error);
        // THEN the function should return the appropriate message
        expect(message).toBe(expectedMessage);
      });
    });

    test.each([
      [ErrorConstants.ErrorCodes.FAILED_TO_FETCH, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.SERVER_CONNECTION_ERROR],
      [ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNABLE_TO_PROCESS_RESPONSE],
      [ErrorConstants.ErrorCodes.INVALID_RESPONSE_HEADER, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNABLE_TO_PROCESS_RESPONSE],
      [ErrorConstants.ErrorCodes.FORBIDDEN, ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNEXPECTED_ERROR],
      ["(none of the above)", ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNEXPECTED_ERROR],
    ])("Should return correct message for '%s' error code", (errorCode, errorMessage) => {
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
      const message = getUserFriendlyErrorMessage(error);
      // THEN the function should return the appropriate message
      expect(message).toBe(errorMessage);
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
      const message = getUserFriendlyErrorMessage(error);

      // THEN the function should return the appropriate message
      expect(message).toBe(ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.UNABLE_TO_PROCESS_REQUEST);
    });
  });
});
