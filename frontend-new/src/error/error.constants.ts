namespace ErrorConstants {
  export enum ErrorCodes {
    MALFORMED_BODY = "MALFORMED_BODY",
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
    NOT_FOUND = "NOT_FOUND",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
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

  export enum ReasonPhrases {
    MALFORMED_BODY = "Payload is malformed, it should be a valid model json",
    INTERNAL_SERVER_ERROR = "Internal Server Error",
    METHOD_NOT_ALLOWED = "Method Not Allowed",
    NOT_FOUND = "Not Found",
    UNSUPPORTED_MEDIA_TYPE = "Unsupported Media Type",
    TOO_LARGE_PAYLOAD = "Payload is too long",
    BAD_REQUEST = "Bad Request",
    INVALID_JSON_SCHEMA = "Invalid json schema",
    FORBIDDEN = "Forbidden",
  }

  export enum FirebaseErrorCodes {
    EMAIL_ALREADY_IN_USE = "auth/email-already-in-use",
    EMAIL_NOT_VERIFIED = "auth/email-not-verified",
    INVALID_CREDENTIAL = "auth/invalid-credential",
    INVALID_EMAIL = "auth/invalid-email",
    OPERATION_NOT_ALLOWED = "auth/operation-not-allowed",
    WEAK_PASSWORD = "auth/weak-password",
    USER_DISABLED = "auth/user-disabled",
    USER_NOT_FOUND = "auth/user-not-found",
    WRONG_PASSWORD = "auth/wrong-password",
    TOO_MANY_REQUESTS = "auth/too-many-requests",
  }

  export const MAX_DETAILS_LENGTH = 4000;
  export const MAX_MESSAGE_LENGTH = 256;
}
export default ErrorConstants;
