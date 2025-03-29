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
 * a map of error codes and more user-friendly error messages that can be shown to the user
 * in case of errors during firebase authentication.
 **/
export const USER_FRIENDLY_FIREBASE_ERROR_MESSAGES: Record<FirebaseErrorCodes, string> = {
  [FirebaseErrorCodes.EMAIL_ALREADY_IN_USE]: "The email address is already in use by another account.",
  [FirebaseErrorCodes.EMAIL_NOT_VERIFIED]:
    "The email you are using is registered, but you have not yet verified it. Please verify your email to continue.",
  [FirebaseErrorCodes.INVALID_CREDENTIAL]: "The email/password provided is invalid.",
  [FirebaseErrorCodes.INVALID_EMAIL]: "The email address is not valid.",
  [FirebaseErrorCodes.OPERATION_NOT_ALLOWED]: "Email/password accounts are not enabled.",
  [FirebaseErrorCodes.WEAK_PASSWORD]: "The password is too weak.",
  [FirebaseErrorCodes.USER_DISABLED]: "The user account has been disabled.",
  [FirebaseErrorCodes.USER_NOT_FOUND]: "No user was found for the given credentials.",
  [FirebaseErrorCodes.WRONG_PASSWORD]: "The password is invalid.",
  [FirebaseErrorCodes.TOO_MANY_REQUESTS]:
    "We have blocked all requests from this device due to unusual activity. Try again later.",
  [FirebaseErrorCodes.INTERNAL_ERROR]: "An internal error has occurred.",
  [FirebaseErrorCodes.TOO_MANY_USERS]: "There are too many users on this Firebase project.",
  [FirebaseErrorCodes.INVALID_REGISTRATION_CODE]:
    "The registration code you entered is invalid. Please check the code and try again.",
  [FirebaseErrorCodes.INVALID_INVITATION_CODE]:
    "The invitation code you entered is invalid. Please check the code and try again.",
  [FirebaseErrorCodes.INVALID_INVITATION_TYPE]:
    "The code you used is for registration and not for login. Please go to the register page.",
  [FirebaseErrorCodes.INVALID_REGISTRATION_TYPE]:
    "The code you used is for login and not for registration. Please go to the login page.",
  [FirebaseErrorCodes.POPUP_CLOSED_BY_USER]:
    "The Google sign-in popup was closed before completing the sign-in process.",
  [FirebaseErrorCodes.INVALID_LOGIN_METHOD]:
    "This operation is not allowed with the current login method.",
  [FirebaseErrorCodes.EMAIL_ALREADY_VERIFIED]: "The email address is already verified.",
};

export function isFirebaseErrorCode(value: string): value is FirebaseErrorCodes {
  return Object.values(FirebaseErrorCodes).includes(value as FirebaseErrorCodes);
}