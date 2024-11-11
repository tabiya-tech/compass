import {
  FirebaseError,
  getFirebaseErrorFactory,
  getUserFriendlyFirebaseErrorMessage
} from "src/error/FirebaseError/firebaseError"

import { FirebaseErrorCodes, USER_FRIENDLY_FIREBASE_ERROR_MESSAGES } from "src/error/FirebaseError/firebaseError.constants";

describe('FirebaseError', () => {
  describe('FirebaseError class', () => {
    test("should contain all the properties", () => {
      // GIVEN a service name, function, method and path
      const givenServiceName = 'service';
      const givenServiceFunction = 'function';
      const givenMethod = 'method';
      const givenErrorCode = FirebaseErrorCodes.INTERNAL_ERROR;
      const givenMessage = 'message';
      const givenDetails = 'details';

      // WHEN creating a new FirebaseError
      const error = new FirebaseError(givenServiceName, givenServiceFunction, givenMethod, givenErrorCode, givenMessage, givenDetails);

      // THEN the FirebaseError should have all the properties
      expect(error.serviceName).toBe(givenServiceName);
      expect(error.serviceFunction).toBe(givenServiceFunction);
      expect(error.method).toBe(givenMethod);
      expect(error.errorCode).toBe(givenErrorCode);
      expect(error.message).toBe(givenMessage);
      expect(error.details).toBe(givenDetails);
    });

    test("should parse the details if it is a stringified JSON", () => {
      // GIVEN a service name, function, method and path
      const givenServiceName = 'service';
      const givenServiceFunction = 'function';
      const givenMethod = 'method';
      const givenErrorCode = FirebaseErrorCodes.INTERNAL_ERROR;
      const givenMessage = 'message';

      const details = { key: "value" };
      const givenDetails = JSON.stringify(details);

      // WHEN creating a new FirebaseError
      const error = new FirebaseError(givenServiceName, givenServiceFunction, givenMethod, givenErrorCode, givenMessage, givenDetails);

      // THEN the FirebaseError should have the parsed details
      expect(error.details).toEqual(details);
    })

    it("should not parse the details if it is not a stringifies JSON but an object", () => {
      // GIVEN a service name, function, method and path
      const givenServiceName = 'service';
      const givenServiceFunction = 'function';
      const givenMethod = 'method';
      const givenErrorCode = FirebaseErrorCodes.INTERNAL_ERROR;
      const givenMessage = 'message';

      const givenDetails = { key: "value" };

      // WHEN creating a new FirebaseError
      const error = new FirebaseError(givenServiceName, givenServiceFunction, givenMethod, givenErrorCode, givenMessage, givenDetails);

      // THEN the FirebaseError should have the parsed details
      expect(error.details).toEqual(givenDetails);
    })
  });

  describe('getUserFriendlyFirebaseErrorMessage', () => {
    // Construct the test cases
    // For each FirebaseErrorCodes, get the user-friendly message
    // If the user-friendly message is not found, use the default message
    const testCases = Object.values(FirebaseErrorCodes).map((errorCode) => [
      errorCode,
      USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[errorCode] || USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[FirebaseErrorCodes.INTERNAL_ERROR],
    ]);

    testCases.push(
      ["custom-unknown-error-message", USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[FirebaseErrorCodes.INTERNAL_ERROR]]
    )

    test.each(testCases)('should return the user friendly message for error code %s', (errorCode, expected) => {
      // GIVEN an error code
      const givenErrorCode = errorCode as FirebaseErrorCodes;

      // WHEN calling getUserFriendlyFirebaseErrorMessage
      const actual = getUserFriendlyFirebaseErrorMessage({ errorCode: givenErrorCode } as any);

      // THEN the function should return the user-friendly message
      expect(actual).toBe(expected);
    })
  });


  describe('getFirebaseErrorFactory', () => {
    it('should return a FirebaseErrorFactory', () => {
      // GIVEN a service name, function, method and path
      const givenServiceName = 'service';
      const givenServiceFunction = 'function';
      const givenMethod = 'method';
      const givenPath = 'path';

      // WHEN calling getFirebaseErrorFactory
      const errorFactory = getFirebaseErrorFactory(givenServiceName, givenServiceFunction, givenMethod, givenPath);

      // THEN the function should return a FirebaseErrorFactory
      expect(errorFactory).toBeDefined();
      expect(errorFactory).toBeInstanceOf(Function);

      // AND the FirebaseErrorFactory should return a FirebaseError
      const givenErrorCode = FirebaseErrorCodes.INTERNAL_ERROR;

      const givenMessage = 'message';
      const givenDetails = 'details';

      const actualError = errorFactory(givenErrorCode, givenMessage, givenDetails);

      // AND the FirebaseError should have the given parameters
      expect(actualError.serviceName).toBe(givenServiceName);
      expect(actualError.serviceFunction).toBe(givenServiceFunction);
      expect(actualError.method).toBe(givenMethod);
      expect(actualError.errorCode).toBe(givenErrorCode);
      expect(actualError.message).toBe(givenMessage);
      expect(actualError.details).toBe(givenDetails);
    });
  })
});
