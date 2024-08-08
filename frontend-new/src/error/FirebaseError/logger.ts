import { FirebaseError } from "./firebaseError";

export function writeFirebaseErrorToLog(err: FirebaseError, logFunction: (msg: any) => void): void {
  const logMessage = `FirebaseError: ${err.serviceName} ${err.serviceFunction} ${err.errorCode} ${err.method} ${err.statusCode}`;

  if (err! instanceof FirebaseError) {
    logFunction(err);
  }

  const obj = {};
  for (const propertyName in err) {
    // @ts-ignore
    if (typeof err[propertyName] !== "function") {
      // @ts-ignore
      obj[propertyName] = err[propertyName];
    }
  }
  // @ts-ignore
  obj["message"] = err.message;
  // @ts-ignore
  obj["stack"] = err.stack;
  // @ts-ignore
  obj["class"] = err.name === "Error" ? err.constructor.name : err.name;
  logFunction(logMessage + obj);
}
