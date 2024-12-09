/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { FirebaseError } from "src/error/FirebaseError/firebaseError";

export function writeFirebaseErrorToLog(err: FirebaseError, logFunction: (msg: any) => void): void {
  const logMessage = `FirebaseError: ${err.serviceName} ${err.serviceFunction} ${err.errorCode} ${err.method}`;

  if (err! instanceof FirebaseError) {
    logFunction(err);
  }

  const obj = {};
  for (const propertyName in err) {
    if (typeof err[propertyName] !== "function") {
      obj[propertyName] = err[propertyName];
    }
  }

  obj["message"] = err.message;
  obj["stack"] = err.stack;
  obj["class"] = err.name === "Error" ? err.constructor.name : err.name;

  // Log both the error and the structured message
  logFunction(logMessage, obj);
}
