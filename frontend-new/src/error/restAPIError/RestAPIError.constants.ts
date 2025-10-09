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
    REQUEST_TOO_LONG: "rest_api_error_request_too_long",
    TOO_MANY_REQUESTS: "rest_api_error_too_many_requests",
    UNEXPECTED_ERROR: "rest_api_error_unexpected_error",
    SERVER_CONNECTION_ERROR: "rest_api_error_server_connection_error",
    RESOURCE_NOT_FOUND: "rest_api_error_resource_not_found",
    AUTHENTICATION_FAILURE: "rest_api_error_authentication_failure",
    PERMISSION_DENIED: "rest_api_error_permission_denied",
    UNABLE_TO_PROCESS_RESPONSE: "rest_api_error_unable_to_process_response",
    SERVICE_UNAVAILABLE: "rest_api_error_service_unavailable",
    DATA_VALIDATION_ERROR: "rest_api_error_data_validation_error",
    UNABLE_TO_PROCESS_REQUEST: "rest_api_error_unable_to_process_request",
  } as const;
}
export default ErrorConstants;
