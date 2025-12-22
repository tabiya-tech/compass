import { StatusCodes } from "http-status-codes/";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import i18n from "src/i18n/i18n";
import { ServiceError } from "src/error/ServiceError";

export type RestAPIErrorObject = {
  errorCode: ErrorConstants.ErrorCodes;
  message: string;
  details: string;
};

export type RestAPIErrorDetails = string | RestAPIErrorObject | object | undefined | null;

export class RestAPIError extends ServiceError {
  method: string;
  path: string;
  statusCode: number;
  errorCode: ErrorConstants.ErrorCodes | string;

  constructor(
    serviceName: string,
    serviceFunction: string,
    method: string,
    path: string,
    statusCode: number,
    errorCode: ErrorConstants.ErrorCodes | string,
    message: string,
    cause?: RestAPIErrorDetails,
  ) {
    super(serviceName,
      serviceFunction,
      `RestAPIError: ${message}`,
      cause,
    );
    this.method = method;
    this.path = path;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

//factory function
export type RestAPIErrorFactory = (
  statusCode: number,
  errorCode: ErrorConstants.ErrorCodes | string,
  message: string,
  cause?: RestAPIErrorDetails,
) => RestAPIError;

export function getRestAPIErrorFactory(
  serviceName: string,
  serviceFunction: string,
  method: string,
  path: string,
): RestAPIErrorFactory {
  return (
    statusCode: number,
    errorCode: ErrorConstants.ErrorCodes | string,
    message: string,
    cause?: RestAPIErrorDetails,
  ): RestAPIError => {
    return new RestAPIError(serviceName, serviceFunction, method, path, statusCode, errorCode, message, cause);
  };
}

export const translateUserFriendlyErrorMessage = (
  key: (typeof ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS)[keyof typeof ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS],
): string => {
  return i18n.t(key);
};


/**
 * @param {RestAPIError} error
 * @returns {string} a user friendly error message
 */

export const getUserFriendlyErrorMessage = (error: RestAPIError | Error): string => {
  if (!(error instanceof RestAPIError)) {
    // in case the error is not a RestAPIError, then it is an unexpected error
    return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.UNEXPECTED_ERROR);
  }
  // All the errors can happen due to a bug in the frontend or backend code.
  // In that case, the users can do little about it, but there might be some cases where a workaround is possible.
  // In other cases, the errors occur due to some temporary issue, e.g. the server is down, the internet connection is down, new version deployed etc.
  // The user-friendly error messages should be written in a way that the user can understand what happened and what they can do about it.
  switch (error.errorCode) {
    case ErrorConstants.ErrorCodes.FAILED_TO_FETCH:
      // The frontend could not establish a connection to the server.
      // This can happen when:
      // - the internet is down
      // - the server is not reachable
      // - slow internet connection and the request timed out
      // - the server is very slow and the request timed out
      // - browser has extensions that block the connection
      // - browser has run out of resources
      // What can the user do:
      // - check the internet connection
      // - try again later
      // - restart or try a different browser
      // - disable browser extensions

      // MESSAGE: Connection to the server cannot be established. Please try the following:
      // - check your internet connection or
      // - disable browser extensions or
      // - restart or try a different browser or
      // - try again later
      return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.SERVER_CONNECTION_ERROR);

    case ErrorConstants.ErrorCodes.API_ERROR:
      if (error.statusCode >= 300 && error.statusCode < 400) {
        // The API has moved.
        // This can happen when:
        // - the user is using an old version of the app
        // What can the user do :
        // - refresh the page to get the latest version of the app
        // - clear the browser cache to get the latest version of the app
        // - if the problem persists, contact support
        return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.UNABLE_TO_PROCESS_RESPONSE);
      }
      switch (error.statusCode) {
        case StatusCodes.UNAUTHORIZED:
          // The user is not authenticated.
          // This can happen when:
          // - the user is not logged in
          // - the user's was "logged" out (token expired, user deleted, etc.)
          // What can the user do :
          // - login
          return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.AUTHENTICATION_FAILURE);
        case StatusCodes.FORBIDDEN:
          // The user is not authorized to perform this action.
          // This can happen when:
          // - the user permissions have changed and the UI has not been updated
          // What can the user do:
          // - logout and login again
          return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.PERMISSION_DENIED);
        case StatusCodes.NOT_FOUND:
          // This happens when:
          // - the user is using an old version of the app
          // - the resource that the user is trying to access has been deleted
          return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.RESOURCE_NOT_FOUND);
        case StatusCodes.TOO_MANY_REQUESTS:
          // This happens when:
          // - the user is making too many requests in a short time
          // What can the user do:
          // - try again later
          return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.TOO_MANY_REQUESTS);
        case StatusCodes.REQUEST_TOO_LONG:
          // This happens when:
          // - the user is sending a payload that exceeds the server's limit
          // - a bug could prohibit the  client to validate the payload correctly,
          // - a validation was not implemented
          // - the user is using an old version of the app and the API has changed
          // What can the user do:
          // - retry with a smaller payload
          // - try again later
          // - refresh the page to get the latest version of the app
          // - clear the browser cache to get the latest version of the app
          return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.REQUEST_TOO_LONG);
      }
      if (error.statusCode >= 400 && error.statusCode < 500) {
        // The server could not or not willing to handle the request
        //  e.g. the request payload or header are invalid, the endpoint does not exist, some consistency violation occurred etc.
        // This can happen when:
        // - missing client validation allows the user to enter invalid data
        // - the client is using older data and the model has changed in the meantime
        // - the user is using an old version of the app and the API has changed
        // - the server refuses to handle the load e.g. too many requests
        // What can the user do:
        // - check the data they entered and try again
        // - refresh the page to get the latest version of the app
        // - clear the browser cache to get the latest version of the app
        // - try again later
        return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.DATA_VALIDATION_ERROR);
      }
      if (error.statusCode === 500) {
        // Server encountered an unexpected condition.
        // This can happen when:
        // - an unexpected error occurred on the server
        // What can the user do:
        // -  try again later
        return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.UNEXPECTED_ERROR);
      }
      if (error.statusCode >= 501) {
        // Server encountered an unexpected condition.
        // This can happen when:
        // - an unexpected error occurred on the server
        // - some part of the infrastructure is down e.g. the gateway, the database, etc.
        // What can the user do:
        // -  try again later
        return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.SERVICE_UNAVAILABLE);
      }
      break;

    case ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY:
    case ErrorConstants.ErrorCodes.INVALID_RESPONSE_HEADER:
      // The frontend could not handle the response.
      // This can happen when:
      // - the API has changed and the user is using an old version of the app
      // What can the user do:
      // - refresh the page to get the latest version of the app
      // - clear the browser cache to get the latest version of the app
      return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.UNABLE_TO_PROCESS_RESPONSE);
    case ErrorConstants.ErrorCodes.FORBIDDEN:
      if (error.statusCode === 422) {
        // we use a forbidden with an unprocessable entity when the invite code is
        return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.UNABLE_TO_PROCESS_REQUEST);
      }
      break;
  }
  // If we get here, then
  // - we messed and don't know what the error is, or
  // - additional error codes where introduced, and we forgot to handle them
  return translateUserFriendlyErrorMessage(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS.UNEXPECTED_ERROR);
};