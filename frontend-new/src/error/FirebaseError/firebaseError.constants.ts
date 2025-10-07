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
 * Consumers should resolve these via i18n.t(USER_FRIENDLY_FIREBASE_ERROR_I18N_KEYS[code]).
 **/
export const USER_FRIENDLY_FIREBASE_ERROR_I18N_KEYS: Record<FirebaseErrorCodes, string> = {
  [FirebaseErrorCodes.EMAIL_ALREADY_IN_USE]: "auth.errors.firebase.emailAlreadyInUse",
  [FirebaseErrorCodes.EMAIL_NOT_VERIFIED]: "auth.errors.firebase.emailNotVerified",
  [FirebaseErrorCodes.INVALID_CREDENTIAL]: "auth.errors.firebase.invalidCredential",
  [FirebaseErrorCodes.INVALID_EMAIL]: "auth.errors.firebase.invalidEmail",
  [FirebaseErrorCodes.OPERATION_NOT_ALLOWED]: "auth.errors.firebase.operationNotAllowed",
  [FirebaseErrorCodes.WEAK_PASSWORD]: "auth.errors.firebase.weakPassword",
  [FirebaseErrorCodes.USER_DISABLED]: "auth.errors.firebase.userDisabled",
  [FirebaseErrorCodes.USER_NOT_FOUND]: "auth.errors.firebase.userNotFound",
  [FirebaseErrorCodes.WRONG_PASSWORD]: "auth.errors.firebase.wrongPassword",
  [FirebaseErrorCodes.TOO_MANY_REQUESTS]: "auth.errors.firebase.tooManyRequests",
  [FirebaseErrorCodes.INTERNAL_ERROR]: "auth.errors.firebase.internalError",
  [FirebaseErrorCodes.TOO_MANY_USERS]: "auth.errors.firebase.tooManyUsers",
  [FirebaseErrorCodes.INVALID_REGISTRATION_CODE]: "auth.errors.firebase.invalidRegistrationCode",
  [FirebaseErrorCodes.INVALID_INVITATION_CODE]: "auth.errors.firebase.invalidInvitationCode",
  [FirebaseErrorCodes.INVALID_INVITATION_TYPE]: "auth.errors.firebase.invalidInvitationType",
  [FirebaseErrorCodes.INVALID_REGISTRATION_TYPE]: "auth.errors.firebase.invalidRegistrationType",
  [FirebaseErrorCodes.POPUP_CLOSED_BY_USER]: "auth.errors.firebase.popupClosedByUser",
  [FirebaseErrorCodes.INVALID_LOGIN_METHOD]: "auth.errors.firebase.invalidLoginMethod",
  [FirebaseErrorCodes.EMAIL_ALREADY_VERIFIED]: "auth.errors.firebase.emailAlreadyVerified"
};


export function isFirebaseErrorCode(value: string): value is FirebaseErrorCodes {
  return Object.values(FirebaseErrorCodes).includes(value as FirebaseErrorCodes);
}