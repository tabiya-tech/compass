import { StatusCodes } from "http-status-codes";
import { UploadStatus } from "./Chat.types";

/**
 * Centralized CV upload error messages
 */
export const CV_UPLOAD_ERROR_MESSAGES = {
  // Character limit errors
  MESSAGE_LIMIT: "Message limit is 1000 characters.",
  INVALID_SPECIAL_CHARACTERS: "Invalid special characters: ",
  
  // File size and type errors
  MAX_FILE_SIZE: "Selected file is too large. Maximum size is 3 MB.",
  FILE_TOO_DENSE: "The uploaded file content is too long to process. Please reduce its length and try again.",
  UNSUPPORTED_FILE_TYPE: "Unsupported file type. Allowed: PDF, DOCX, TXT.",
  
  // CV processing errors
  CV_MARKDOWN_TOO_LONG: "Your CV content is too long. Please shorten your CV and try again.",
  EMPTY_CV_PARSE: "We couldn't detect experiences in your CV. Please check the file and try again.",
  GENERIC_UPLOAD_ERROR: "Failed to parse your CV. Please try again or use a different file.",
  
  // Rate limiting and quota errors
  RATE_LIMIT_WAIT: "Too many uploads at once. Please wait one minute and try again.",
  MAX_UPLOADS_REACHED: "You've reached the maximum number of CV uploads for this conversation. Further uploads aren't allowed.",
  
  // Duplicate and conflict errors
  DUPLICATE_CV: "This CV has already been uploaded. Select it from your previously uploaded CVs.",
  
  // Timeout errors
  UPLOAD_TIMEOUT: "The upload timed out. Please try again.",
  
  // Authentication errors
  UNAUTHORIZED: "You are not authorized. Please sign in again.",
  
  // Not found errors
  UPLOAD_NOT_FOUND: "Upload not found. It may have failed to start.",
  
  // Generic server errors
  SERVER_ERROR: "We couldn't process your CV right now. Please try again.",
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
      return "You are not authorized. Please sign in again.";
    case 404:
      return "Upload not found. It may have failed to start.";
    case 413:
      return "File too large. Please upload a smaller CV.";
    case 415:
      return "Unsupported file type. Allowed: PDF, DOCX, TXT.";
    case 429:
      return "You are uploading too fast. Please wait and try again.";
    case 408:
    case 504:
      return "The upload timed out. Please try again.";
    case 409:
      return "This CV seems to have been uploaded already.";
    case 500:
    default:
      return detail || "We couldn't process your CV right now. Please try again.";
  }
};
