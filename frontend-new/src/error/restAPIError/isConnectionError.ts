import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";

const NETWORK_ERROR_MESSAGE_PATTERN = /failed to fetch|networkerror|network request failed/i;

export const isConnectionError = (error: unknown): boolean => {
  if (error instanceof RestAPIError) {
    return (
      error.errorCode === ErrorConstants.ErrorCodes.FAILED_TO_FETCH ||
      (error.errorCode === ErrorConstants.ErrorCodes.API_ERROR && error.statusCode === 0)
    );
  }

  if (error instanceof Error) {
    return NETWORK_ERROR_MESSAGE_PATTERN.test(error.message);
  }

  if (typeof error === "object" && error !== null) {
    const errorLike = error as { errorCode?: unknown; statusCode?: unknown; message?: unknown };
    const hasFailedToFetchCode = errorLike.errorCode === ErrorConstants.ErrorCodes.FAILED_TO_FETCH;
    const hasApiErrorConnectionSignature =
      errorLike.errorCode === ErrorConstants.ErrorCodes.API_ERROR && errorLike.statusCode === 0;

    if (hasFailedToFetchCode || hasApiErrorConnectionSignature) {
      return true;
    }

    return typeof errorLike.message === "string" && NETWORK_ERROR_MESSAGE_PATTERN.test(errorLike.message);
  }

  return false;
};
