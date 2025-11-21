import {
  FirebaseErrorCodes,
  isFirebaseErrorCode,
  USER_FRIENDLY_FIREBASE_ERROR_I18N_KEYS,
} from "src/error/FirebaseError/firebaseError.constants";
import { ServiceError } from "src/error/ServiceError";
import { FirebaseError as _FirebaseError } from "@firebase/util";
import i18n from "src/i18n/i18n";

export class FirebaseError extends ServiceError {
  errorCode: FirebaseErrorCodes | string;

  constructor(
    serviceName: string,
    serviceFunction: string,
    errorCode: FirebaseErrorCodes | string,
    message: string,
    cause?: unknown,
  ) {
    super(serviceName, serviceFunction, `FirebaseError: ${message}`, cause);
    this.errorCode = errorCode;
  }
}

//factory function
export type FirebaseErrorFactory = (
  errorCode: FirebaseErrorCodes | string,
  message: string,
  cause?: unknown,
) => FirebaseError;

export function getFirebaseErrorFactory(
  serviceName: string,
  serviceFunction: string,
): FirebaseErrorFactory {
  return (errorCode: FirebaseErrorCodes | string, message: string, cause?: unknown): FirebaseError => {
    return new FirebaseError(serviceName,
      serviceFunction,
      errorCode,
      message,
      cause);
  };
}

export const getUserFriendlyFirebaseErrorMessage = (firebaseError: FirebaseError): string => {
  // Resolve to a translation key first, then translate
  const key = isFirebaseErrorCode(firebaseError.errorCode)
    ? USER_FRIENDLY_FIREBASE_ERROR_I18N_KEYS[firebaseError.errorCode] ||
      USER_FRIENDLY_FIREBASE_ERROR_I18N_KEYS[FirebaseErrorCodes.INTERNAL_ERROR]
    : USER_FRIENDLY_FIREBASE_ERROR_I18N_KEYS[FirebaseErrorCodes.INTERNAL_ERROR];

  return i18n.t(key);
};

/**
 *  Cast a FirebaseError from '@firebase/util' to a compass FirebaseError in a safe way.
 *  The error is expected to have the following properties:
 *  - code: string
 *  - message: string
 *  If the error does not have these properties,
 *  a compass FirebaseError with errorCode FirebaseErrorCodes.INTERNAL_ERROR is returned
 *
 *  It's intended use is in catch block
 *  try {
 *    // do something that may throw a firebase.auth.FirebaseError or any other error
 *  }
 *  catch (e) {
 *    throw castToFirebaseError(e, getFirebaseErrorFactory("serviceName", "functionName"));
 *  }
 * @param e - the error to cast
 * @param errorFactory - the factory function to create a FirebaseError
 */
export function castToFirebaseError(e: unknown, errorFactory: FirebaseErrorFactory): FirebaseError {
  if (_isAuthFirebaseError(e)) {
    return errorFactory(e.code, e.message);
  } else {
    return errorFactory(FirebaseErrorCodes.INTERNAL_ERROR, "An unknown error occurred", e);
  }
}

function _isAuthFirebaseError(error: unknown): error is _FirebaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}