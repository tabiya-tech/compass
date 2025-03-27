import { FirebaseError } from "./firebaseError";
import { FirebaseErrorCodes } from "./firebaseError.constants";
import { writeFirebaseErrorToLog } from "./logger";

describe("Test writeFirebaseErrorToLog", () => {
  test("should write to log", () => {
    const err = new FirebaseError(
      "service",
      "function",
      "method",
      FirebaseErrorCodes.INVALID_CREDENTIAL,
      "message",
      new Error("cause of the error", { cause: Error("cause fo the cause") })
    );
    const logFunction = jest.fn();
    writeFirebaseErrorToLog(err, logFunction);
    expect(logFunction).toBeCalledTimes(1);
  });
});