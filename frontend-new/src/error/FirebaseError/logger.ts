/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { FirebaseError } from "src/error/FirebaseError/firebaseError";

export function writeFirebaseErrorToLog(err: FirebaseError, logFunction: (msg: any) => void): void {
  const logMessage = `FirebaseError: ${err.message}, `;

  const obj = {};
  for (const propertyName in err) {
    if (typeof err[propertyName] !== "function") {
      obj[propertyName] = err[propertyName];
    }
  }

  obj["serviceFunction"] = err.serviceFunction;
  obj["serviceName"] = err.serviceName;
  obj["method"] = err.method;
  obj["errorCode"] = err.errorCode;
  obj["stack"] = err.stack;
  obj["class"] = err.name === "Error" ? err.constructor.name : err.name;

  // Log both the error and the structured message
  logFunction(logMessage, JSON.stringify(obj, null, 2));
}
