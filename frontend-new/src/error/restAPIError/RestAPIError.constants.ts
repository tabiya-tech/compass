namespace ErrorConstants {
  export enum ErrorCodes {
    MALFORMED_BODY = "MALFORMED_BODY",
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
    NOT_FOUND = "NOT_FOUND",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
    UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE",
    TOO_LARGE_PAYLOAD = "TOO_LARGE_PAYLOAD",
    BAD_REQUEST = "BAD_REQUEST",
    INVALID_JSON_SCHEMA = "INVALID_JSON_SCHEMA",
    FORBIDDEN = "FORBIDDEN",
    FAILED_TO_FETCH = "FAILED_TO_FETCH",
    INVALID_RESPONSE_BODY = "INVALID_RESPONSE_BODY",
    INVALID_RESPONSE_HEADER = "INVALID_RESPONSE_HEADER",
    API_ERROR = "API_ERROR",
  }

  export const USER_FRIENDLY_ERROR_MESSAGES = {
    REQUEST_TOO_LONG:
      "The data sent to the service seems to be too large. " +
      "Please try again with a smaller payload. " +
      "If the problem persists, clear your browser's cache and refresh the page.",
    TOO_MANY_REQUESTS: "It looks like you are making too many requests. Please slow down and try again later.",
    UNEXPECTED_ERROR: "An unexpected error occurred. Please try again later.",
    SERVER_CONNECTION_ERROR: "Cannot connect to the service. Please check your internet connection or try again later.",
    RESOURCE_NOT_FOUND: "The requested resource was not found. Please clear your browser's cache and refresh the page.",
    AUTHENTICATION_FAILURE: "It looks like you not logged in. Please log in to continue.",
    PERMISSION_DENIED: "It looks like you do not have the necessary permissions. Please log out and log in again.",
    UNABLE_TO_PROCESS_RESPONSE:
      "We encountered an issue while processing data. Clear the browser's cache and refresh or try again later.",
    SERVICE_UNAVAILABLE: "The service is currently unavailable. Please try again later.",
    DATA_VALIDATION_ERROR:
      "There seems to be an issue with your request. " +
      "If you're submitting data, please make sure they're valid and try again. " +
      "If the problem persists, clear your browser's cache and refresh the page.",
    UNABLE_TO_PROCESS_REQUEST: "Apologies. Something went wrong while processing your request.",
  };
}
export default ErrorConstants;
