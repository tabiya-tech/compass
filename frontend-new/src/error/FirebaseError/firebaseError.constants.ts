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
  INTERNAL_ERROR = "auth/internal-error",
  TOO_MANY_USERS = "auth/too-many-users",
  POPUP_CLOSED_BY_USER = "auth/popup-closed-by-user",
  INVALID_LOGIN_METHOD = "auth/invalid-login-method",
  INVALID_REGISTRATION_CODE = "INVALID_REGISTRATION_CODE",
  INVALID_INVITATION_CODE = "INVALID_INVITATION_CODE",
  INVALID_INVITATION_TYPE = "INVALID_INVITATION_TYPE",
  INVALID_REGISTRATION_TYPE = "INVALID_REGISTRATION_TYPE",
  EMAIL_ALREADY_VERIFIED = "auth/email-already-verified",
}

/**
 * Map of error codes to i18n translation keys for user-friendly messages.
 * Consumers should resolve these via i18n.t(USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[code]).
 **/
export const USER_FRIENDLY_FIREBASE_ERROR_MESSAGES: Record<FirebaseErrorCodes, string> = {
  [FirebaseErrorCodes.EMAIL_ALREADY_IN_USE]: "firebase_error_email_already_in_use",
  [FirebaseErrorCodes.EMAIL_NOT_VERIFIED]: "firebase_error_email_not_verified",
  [FirebaseErrorCodes.INVALID_CREDENTIAL]: "firebase_error_invalid_credential",
  [FirebaseErrorCodes.INVALID_EMAIL]: "firebase_error_invalid_email",
  [FirebaseErrorCodes.OPERATION_NOT_ALLOWED]: "firebase_error_operation_not_allowed",
  [FirebaseErrorCodes.WEAK_PASSWORD]: "firebase_error_weak_password",
  [FirebaseErrorCodes.USER_DISABLED]: "firebase_error_user_disabled",
  [FirebaseErrorCodes.USER_NOT_FOUND]: "firebase_error_user_not_found",
  [FirebaseErrorCodes.WRONG_PASSWORD]: "firebase_error_wrong_password",
  [FirebaseErrorCodes.TOO_MANY_REQUESTS]: "firebase_error_too_many_requests",
  [FirebaseErrorCodes.INTERNAL_ERROR]: "firebase_error_internal_error",
  [FirebaseErrorCodes.TOO_MANY_USERS]: "firebase_error_too_many_users",
  [FirebaseErrorCodes.INVALID_REGISTRATION_CODE]: "firebase_error_invalid_registration_code",
  [FirebaseErrorCodes.INVALID_INVITATION_CODE]: "firebase_error_invalid_invitation_code",
  [FirebaseErrorCodes.INVALID_INVITATION_TYPE]: "firebase_error_invalid_invitation_type",
  [FirebaseErrorCodes.INVALID_REGISTRATION_TYPE]: "firebase_error_invalid_registration_type",
  [FirebaseErrorCodes.POPUP_CLOSED_BY_USER]: "firebase_error_popup_closed_by_user",
  [FirebaseErrorCodes.INVALID_LOGIN_METHOD]: "firebase_error_invalid_login_method",
  [FirebaseErrorCodes.EMAIL_ALREADY_VERIFIED]: "firebase_error_email_already_verified",
};

export function isFirebaseErrorCode(value: string): value is FirebaseErrorCodes {
  return Object.values(FirebaseErrorCodes).includes(value as FirebaseErrorCodes);
}