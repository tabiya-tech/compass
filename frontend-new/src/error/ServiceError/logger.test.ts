import { ServiceError } from "./ServiceError";
import { writeServiceErrorToLog } from "./logger";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";

describe("Test writeServiceErrorToLog", () => {
  test("should write to log", () => {
    const err = new ServiceError(
      "service",
      "function",
      "method",
      "path",
      400,
      ErrorConstants.ErrorCodes.API_ERROR,
      "message",
      new Error()
    );
    const logFunction = jest.fn();
    writeServiceErrorToLog(err, logFunction);
    expect(logFunction).toBeCalledTimes(1);
  });
});
