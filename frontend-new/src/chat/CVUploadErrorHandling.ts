import { StatusCodes } from "http-status-codes";
import { UploadStatus } from "./Chat.types";
import i18n from "src/i18n/i18n";

/**
 * Centralized CV upload error message KEYS
 * NOTE: These are i18n keys. Resolve to text via t()/i18n.t() at call/render time.
 */
export const CV_UPLOAD_ERROR_MESSAGES = {
  // Character limit errors
  MESSAGE_LIMIT: "chat_message_error_limit",
  INVALID_SPECIAL_CHARACTERS: "chat_message_error_invalid_chars",

  // File size and type errors
  MAX_FILE_SIZE: "chat_message_cv_error_max_file_size",
  FILE_TOO_DENSE: "chat_message_cv_error_too_dense",
  UNSUPPORTED_FILE_TYPE: "chat_message_cv_error_unsupported_file_type",

  // CV processing errors
  CV_MARKDOWN_TOO_LONG: "chat_message_cv_error_cv_markdown_too_long",
  EMPTY_CV_PARSE: "chat_message_cv_error_empty_parse",
  GENERIC_UPLOAD_ERROR: "chat_message_cv_error_generic",

  // Rate limiting and quota errors
  RATE_LIMIT_WAIT: "chat_message_cv_error_rate_limit",
  MAX_UPLOADS_REACHED: "chat_message_cv_error_max_uploads_reached",

  // Duplicate and conflict errors
  DUPLICATE_CV: "chat_message_cv_error_duplicate",

  // Timeout errors
  UPLOAD_TIMEOUT: "chat_message_cv_error_timeout",

  // Authentication errors
  UNAUTHORIZED: "chat_message_cv_error_unauthorized",

  // Not found errors
  UPLOAD_NOT_FOUND: "chat_message_cv_error_upload_not_found",

  // Generic server errors
  SERVER_ERROR: "chat_message_cv_error_generic",
} as const;

/**
 * Maps HTTP status codes to user-friendly error messages for CV uploads
 * Used for immediate upload failures (before polling starts)
 */
export const getCvUploadErrorMessageFromHttpStatus = (status: number, detail?: string): string => {
  switch (status) {
    case StatusCodes.UNAUTHORIZED:
      return CV_UPLOAD_ERROR_MESSAGES.UNAUTHORIZED;
    
    case StatusCodes.FORBIDDEN:
      return CV_UPLOAD_ERROR_MESSAGES.MAX_UPLOADS_REACHED;
    
    case StatusCodes.NOT_FOUND:
      return CV_UPLOAD_ERROR_MESSAGES.UPLOAD_NOT_FOUND;
    
    case StatusCodes.REQUEST_TOO_LONG:
      return CV_UPLOAD_ERROR_MESSAGES.FILE_TOO_DENSE;
    
    case StatusCodes.UNSUPPORTED_MEDIA_TYPE:
      return CV_UPLOAD_ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE;
    
    case StatusCodes.TOO_MANY_REQUESTS:
      return CV_UPLOAD_ERROR_MESSAGES.RATE_LIMIT_WAIT;
    
    case StatusCodes.CONFLICT:
      return CV_UPLOAD_ERROR_MESSAGES.DUPLICATE_CV;
    
    case StatusCodes.REQUEST_TIMEOUT:
    case StatusCodes.GATEWAY_TIMEOUT:
      return CV_UPLOAD_ERROR_MESSAGES.UPLOAD_TIMEOUT;
    
    case StatusCodes.INTERNAL_SERVER_ERROR:
    default:
      // If backend provided a detail message, return it as-is (will be rendered literally)
      return detail || CV_UPLOAD_ERROR_MESSAGES.SERVER_ERROR;
  }
};

/**
 * Maps CV upload error codes (from polling) to user-friendly error messages
 * Used for processing failures discovered during polling
 */
export const getCvUploadErrorMessageFromErrorCode = (status: UploadStatus): string | null => {
  if (status.upload_process_state !== "FAILED") return null;
  
  const errorCode = status.error_code;
  const errorDetail = status.error_detail;
  
  switch (errorCode) {
    case "MARKDOWN_TOO_LONG":
      return CV_UPLOAD_ERROR_MESSAGES.CV_MARKDOWN_TOO_LONG;
    
    case "EMPTY_CV_PARSE":
      return CV_UPLOAD_ERROR_MESSAGES.EMPTY_CV_PARSE;
    
    case "FILE_TOO_DENSE":
      return CV_UPLOAD_ERROR_MESSAGES.FILE_TOO_DENSE;
    
    case "RATE_LIMIT_WAIT":
      return CV_UPLOAD_ERROR_MESSAGES.RATE_LIMIT_WAIT;
    
    case "MAX_UPLOADS_REACHED":
      return CV_UPLOAD_ERROR_MESSAGES.MAX_UPLOADS_REACHED;
    
    case "DUPLICATE_CV":
      return CV_UPLOAD_ERROR_MESSAGES.DUPLICATE_CV;
    
    case "UNSUPPORTED_FILE_TYPE":
      return CV_UPLOAD_ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE;
    
    case "UPLOAD_TIMEOUT":
      return CV_UPLOAD_ERROR_MESSAGES.UPLOAD_TIMEOUT;
    
    default:
      return errorDetail || CV_UPLOAD_ERROR_MESSAGES.GENERIC_UPLOAD_ERROR;
  }
};

/**
 * Legacy function for backward compatibility with cvUploadPolling.ts
 * Maps HTTP status codes to error messages (used in polling error handling)
 */
export const getUploadErrorMessage = (status: number, detail?: string): string => {
  switch (status) {
    case 401:
    case 403:
      return i18n.t(CV_UPLOAD_ERROR_MESSAGES.UNAUTHORIZED);
    case 404:
      return i18n.t(CV_UPLOAD_ERROR_MESSAGES.UPLOAD_NOT_FOUND);
    case 413:
      return i18n.t(CV_UPLOAD_ERROR_MESSAGES.MAX_FILE_SIZE);
    case 415:
      return i18n.t(CV_UPLOAD_ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE);
    case 429:
      return i18n.t(CV_UPLOAD_ERROR_MESSAGES.RATE_LIMIT_WAIT);
    case 408:
    case 504:
      return i18n.t(CV_UPLOAD_ERROR_MESSAGES.UPLOAD_TIMEOUT);
    case 409:
      return i18n.t(CV_UPLOAD_ERROR_MESSAGES.DUPLICATE_CV);
    case 500:
    default:
      return detail || i18n.t(CV_UPLOAD_ERROR_MESSAGES.GENERIC_UPLOAD_ERROR);
  }
};
