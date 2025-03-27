import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { writeRestAPIErrorToLog } from "src/error/restAPIError/logger";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";

describe("Test writeRestAPIErrorToLog", () => {
  test("should write to log", () => {
    const err = new RestAPIError(
      "service",
      "function",
      "method",
      "path",
      400,
      ErrorConstants.ErrorCodes.API_ERROR,
      "message",
      new Error("cause of the error", { cause: Error("cause fo the cause") })
    );
    const logFunction = jest.fn();
    writeRestAPIErrorToLog(err, logFunction);
    expect(logFunction).toBeCalledTimes(1);
  });
});
