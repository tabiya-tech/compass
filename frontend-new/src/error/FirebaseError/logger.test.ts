import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";

describe("writeFirebaseErrorToLog", () => {
  let mockLogFunction: jest.Mock;

  beforeEach(() => {
    mockLogFunction = jest.fn();
  });

  it("should call log function with a structured message", () => {
    // GIVEN a FirebaseError object
    const givenService = "service";
    const givenFunction = "function";
    const givenMethod = "method";
    const givenMessage = "message";
    const givenDetails = "details";

    const givenErrorCode = FirebaseErrorCodes.INTERNAL_ERROR;

    const givenFireBaseError = new FirebaseError(
      givenService,
      givenFunction,
      givenMethod,
      givenErrorCode,
      givenMessage,
      givenDetails
    );

    // WHEN the function is called
    writeFirebaseErrorToLog(givenFireBaseError, mockLogFunction);

    // THEN the log function should be called once with a structured message
    expect(mockLogFunction).toHaveBeenCalledTimes(1);

    // AND log function should have been called with the message and the error object
    expect(mockLogFunction).toHaveBeenNthCalledWith(1, `FirebaseError: ${givenMessage}, `, JSON.stringify({
      serviceName: givenService,
      serviceFunction: givenFunction,
      method: givenMethod,
      errorCode: givenErrorCode,
      details: givenDetails,
      stack: givenFireBaseError.stack,
      class: FirebaseError.name,
    }, null, 2));
  });

  it("should call logFunction with ony one time if error is not instance of FirebaseError", () => {
    // GIVEN a FirebaseError object
    const givenError = new Error("Error message");

    // WHEN the function is called

    // @ts-ignore
    writeFirebaseErrorToLog(givenError, mockLogFunction);

    // THEN the log function should be called with a structured message
    expect(mockLogFunction).toHaveBeenCalledTimes(1);
  });

  it("should not include functions in the log object", () => {
    // GIVEN a FirebaseError object

    const givenService = "service";
    const givenFunction = "function";
    const givenMethod = "method";
    const givenMessage = "message";
    const givenDetails = "details";

    const givenErrorCode = FirebaseErrorCodes.INTERNAL_ERROR;

    const givenFireBaseError = new FirebaseError(
      givenService,
      givenFunction,
      givenMethod,
      givenErrorCode,
      givenMessage,
      givenDetails
    );

    const givenCustomValue = "customValue";
    // @ts-ignore
    givenFireBaseError["customValue"] = givenCustomValue;

    // @ts-ignore
    givenFireBaseError["customFunction"] = () => true;

    // WHEN the function is called
    writeFirebaseErrorToLog(givenFireBaseError, mockLogFunction);

    // THEN the log function should be called once with a structured message
    expect(mockLogFunction).toHaveBeenCalledTimes(1);

    // AND log function should have been called with the message and the error object
    expect(mockLogFunction).toHaveBeenNthCalledWith(1, `FirebaseError: ${givenMessage}, `, JSON.stringify({
      serviceName: givenService,
      serviceFunction: givenFunction,
      method: givenMethod,
      errorCode: givenErrorCode,
      details: givenDetails,
      customValue: givenCustomValue,
      stack: givenFireBaseError.stack,
      class: FirebaseError.name,
    }, null, 2));
  });
});
