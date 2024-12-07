import { FirebaseError } from "src/error/FirebaseError/firebaseError";

export function writeFirebaseErrorToLog(err: FirebaseError, logFunction: (msg: any) => void): void {
  const logMessage = `FirebaseError: ${err.serviceName} ${err.serviceFunction} ${err.errorCode} ${err.method}`;

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

  // Log both the error and the structured message
  logFunction({ message: logMessage, error: obj });
}
