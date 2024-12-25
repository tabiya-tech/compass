import { RestAPIErrorDetails } from "src/error/restAPIError/RestAPIError";
import {
  FirebaseErrorCodes,
  USER_FRIENDLY_FIREBASE_ERROR_MESSAGES,
} from "src/error/FirebaseError/firebaseError.constants";

export class FirebaseError extends Error {
  serviceName: string;
  serviceFunction: string;
  method: string;
  errorCode: FirebaseErrorCodes;
  details: RestAPIErrorDetails;

  constructor(
    serviceName: string,
    serviceFunction: string,
    method: string,
    errorCode: FirebaseErrorCodes,
    message: string,
    details?: RestAPIErrorDetails
  ) {
    super(message);
    this.serviceName = serviceName;
    this.serviceFunction = serviceFunction;
    this.method = method;
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
  errorCode: FirebaseErrorCodes,
  message: string,
  details?: RestAPIErrorDetails
) => FirebaseError;

export function getFirebaseErrorFactory(
  serviceName: string,
  serviceFunction: string,
  method: string,
  path: string
): FirebaseErrorFactory {
  return (errorCode: FirebaseErrorCodes, message: string, details?: RestAPIErrorDetails): FirebaseError => {
    return new FirebaseError(serviceName, serviceFunction, method, errorCode, message, details);
  };
}

export const getUserFriendlyFirebaseErrorMessage = (firebaseError: FirebaseError): string => {
  return (
    USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[firebaseError.errorCode] ||
    USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[FirebaseErrorCodes.INTERNAL_ERROR]
  );
};
