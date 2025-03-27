  /* eslint-disable @typescript-eslint/no-explicit-any */
  // @ts-nocheck
  import { RestAPIError } from "src/error/restAPIError/RestAPIError";
  import { serializeError } from "src/error/errorSerializer";

  export function writeRestAPIErrorToLog(err: RestAPIError, logFunction: (msg: any) => void): void {
    const logMessage = `RestAPIServiceError: ${err.message}`;
    const serialized = serializeError(err);
    logFunction(logMessage, JSON.stringify(serialized, null, 2));
  }

