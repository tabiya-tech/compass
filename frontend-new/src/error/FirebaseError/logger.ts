/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import { serializeError } from "src/error/errorSerializer";

export function writeFirebaseErrorToLog(err: FirebaseError, logFunction: (msg: any) => void): void {
  const logMessage = `FirebaseError: ${err.message}, `;
  const serialized = serializeError(err);
  logFunction(logMessage, JSON.stringify(serialized, null, 2));
}
