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
  INVALID_REGISTRATION_CODE = "INVALID_REGISTRATION_CODE",
  INVALID_INVITATION_CODE = "INVALID_INVITATION_CODE",
  INVALID_INVITATION_TYPE = "INVALID_INVITATION_TYPE",
  INVALID_REGISTRATION_TYPE = "INVALID_REGISTRATION_TYPE",
}


export const USER_FRIENDLY_FIREBASE_ERROR_MESSAGES = {
  [FirebaseErrorCodes.EMAIL_ALREADY_IN_USE]: "The email address is already in use by another account.",
  "auth/email-not-verified":
    "The email you are using is registered, but you have not yet verified it. Please verify your email to continue.",
  "auth/invalid-credential": "The email/password provided is invalid.",
  "auth/invalid-email": "The email address is not valid.",
  "auth/operation-not-allowed": "Email/password accounts are not enabled.",
  "auth/weak-password": "The password is too weak.",
  "auth/user-disabled": "The user account has been disabled.",
  "auth/user-not-found": "No user was found for the given credentials.",
  "auth/wrong-password": "The password is invalid.",
  "auth/too-many-requests": "We have blocked all requests from this device due to unusual activity. Try again later.",
  "auth/internal-error": "An internal error has occurred.",
  "auth/too-many-users": "There are too many users on this Firebase project.",
  INVALID_REGISTRATION_CODE: "The registration code you entered is invalid. Please check the code and try again.",
  INVALID_INVITATION_CODE: "The invitation code you entered is invalid. Please check the code and try again.",
  INVALID_INVITATION_TYPE:
    "The invitation code you used is for registration rather than logging in. Please go to the register page.",
  INVALID_REGISTRATION_TYPE:
    "The invitation code you used is for logging in rather than registration. Please go to the login page.",
};