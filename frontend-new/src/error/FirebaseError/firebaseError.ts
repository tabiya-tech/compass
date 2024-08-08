import { ServiceErrorDetails } from "src/error/ServiceError/ServiceError";
import { FirebaseErrorCodes } from "./firebaseError.constants";

/**
 * a map of error codes and more user-friendly error messages that can be shown to the user
 * in case of Firebase authentication errors.
 **/
export const USER_FRIENDLY_FIREBASE_ERROR_MESSAGES = {
  "auth/email-already-in-use": "The email address is already in use by another account.",
  "auth/email-not-verified":
    "The email you are using is registered, but you have not yet verified it. Please verify your email to continue.",
  "auth/invalid-credential": "The email/password provided is invalid.",
  "auth/invalid-email": "The email address is not valid.",
  "auth/operation-not-allowed": "Email/password accounts are not enabled.",
  "auth/weak-password": "The password is too weak.",
  "auth/user-disabled": "The user account has been disabled.",
  "auth/user-not-found": "There is no user record corresponding to this email.",
  "auth/wrong-password": "The password is invalid.",
  "auth/too-many-requests": "We have blocked all requests from this device due to unusual activity. Try again later.",
  "auth/internal-error": "An internal error has occurred.",
  "auth/too-many-users": "There are too many users on this Firebase project.",
};

export class FirebaseError extends Error {
  serviceName: string;
  serviceFunction: string;
  method: string;
  statusCode: number;
  errorCode: FirebaseErrorCodes;
  details: ServiceErrorDetails;

  constructor(
    serviceName: string,
    serviceFunction: string,
    method: string,
    statusCode: number,
    errorCode: FirebaseErrorCodes,
    message: string,
    details?: ServiceErrorDetails
  ) {
    super(message);
    this.serviceName = serviceName;
    this.serviceFunction = serviceFunction;
    this.method = method;
    this.statusCode = statusCode;
    this.errorCode = errorCode;

    // if the details is an object, or a JSON representation of an object,
    // then add it as an object to the details property,
    // otherwise just add the details as a string
    if (typeof details === "string") {
      try {
        this.details = JSON.parse(details);
      } catch (e) {
        this.details = details;
      }
    } else {
      this.details = details;
    }
  }
}

//factory function
export type FirebaseErrorFactory = (
  statusCode: number,
  errorCode: FirebaseErrorCodes,
  message: string,
  details?: ServiceErrorDetails
) => FirebaseError;

export function getFirebaseErrorFactory(
  serviceName: string,
  serviceFunction: string,
  method: string,
  path: string
): FirebaseErrorFactory {
  return (
    statusCode: number,
    errorCode: FirebaseErrorCodes,
    message: string,
    details?: ServiceErrorDetails
  ): FirebaseError => {
    return new FirebaseError(serviceName, serviceFunction, method, statusCode, errorCode, message, details);
  };
}

export const getUserFriendlyFirebaseErrorMessage = (firebaseError: FirebaseError): string => {
  return (
    USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[firebaseError.errorCode] ||
    USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[FirebaseErrorCodes.INTERNAL_ERROR]
  );
};
