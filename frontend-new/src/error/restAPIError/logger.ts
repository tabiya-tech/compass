/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { RestAPIError } from "src/error/restAPIError/RestAPIError";

export function writeRestAPIErrorToLog(err: RestAPIError, logFunction: (msg: any) => void): void {
  const logMessage = `ServiceError: ${err.message}, `;
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

  logFunction(logMessage, JSON.stringify(obj, null, 2));
}
