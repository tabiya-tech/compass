import { StatusCodes } from "http-status-codes";
import { UploadStatus } from "./Chat.types";
import i18n from "src/i18n/i18n";

/**
 * Centralized CV upload error message KEYS
 * NOTE: These are i18n keys. Resolve to text via t()/i18n.t() at call/render time.
 */
export const CV_UPLOAD_ERROR_MESSAGES = {
  // Character limit errors
  MESSAGE_LIMIT: "common.chat.errors.messageLimit",
  INVALID_SPECIAL_CHARACTERS: "common.chat.errors.invalidSpecialCharacters",

  // File size and type errors
  MAX_FILE_SIZE: "common.upload.errors.maxFileSize",
  FILE_TOO_DENSE: "common.upload.errors.tooDense",
  UNSUPPORTED_FILE_TYPE: "common.upload.errors.unsupportedFileType",

  // CV processing errors
  CV_MARKDOWN_TOO_LONG: "common.upload.errors.cvMarkdownTooLong",
  EMPTY_CV_PARSE: "common.upload.errors.emptyParse",
  GENERIC_UPLOAD_ERROR: "common.upload.errors.generic",

  // Rate limiting and quota errors
  RATE_LIMIT_WAIT: "common.upload.errors.rateLimit",
  MAX_UPLOADS_REACHED: "common.upload.errors.maxUploadsReached",

  // Duplicate and conflict errors
  DUPLICATE_CV: "common.upload.errors.duplicate",

  // Timeout errors
  UPLOAD_TIMEOUT: "common.upload.errors.timeout",

  // Authentication errors
  UNAUTHORIZED: "common.upload.errors.unauthorized",

  // Not found errors
  UPLOAD_NOT_FOUND: "common.upload.errors.uploadNotFound",

  // Generic server errors
  SERVER_ERROR: "common.upload.errors.generic",
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
