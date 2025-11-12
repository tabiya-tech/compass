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

  // Map of user-friendly message identifiers to i18n translation keys.
  // These keys are resolved at call/render time using the app's initialized i18n instance.
  export const USER_FRIENDLY_ERROR_MESSAGE_KEYS = {
    REQUEST_TOO_LONG: "common.errors.api.requestTooLong",
    TOO_MANY_REQUESTS: "common.errors.api.tooManyRequests",
    UNEXPECTED_ERROR: "common.errors.api.unexpectedError",
    SERVER_CONNECTION_ERROR: "common.errors.api.serverConnectionError",
    RESOURCE_NOT_FOUND: "common.errors.api.resourceNotFound",
    AUTHENTICATION_FAILURE: "common.errors.api.authenticationFailure",
    PERMISSION_DENIED: "common.errors.api.permissionDenied",
    UNABLE_TO_PROCESS_RESPONSE: "common.errors.api.unableToProcessResponse",
    SERVICE_UNAVAILABLE: "common.errors.api.serviceUnavailable",
    DATA_VALIDATION_ERROR: "common.errors.api.dataValidationError",
    UNABLE_TO_PROCESS_REQUEST: "common.errors.api.unableToProcessRequest",
  } as const;
}
export default ErrorConstants;
