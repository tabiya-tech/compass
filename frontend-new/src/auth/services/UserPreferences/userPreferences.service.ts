import { getServiceErrorFactory } from "src/error/error";
import { UserPreference } from "./userPreferences.types";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/error.constants";
import { getBackendUrl } from "src/envService";
import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";
import { fetchWithAuth } from "src/apiService/APIService";

export default class UserPreferencesService {
  private static instance: UserPreferencesService;

  readonly userPreferencesEndpointUrl: string;
  readonly apiServerUrl: string;

  constructor() {
    this.apiServerUrl = getBackendUrl();
    this.userPreferencesEndpointUrl = `${this.apiServerUrl}/users/preferences`;
  }

  /**
   * Get the singleton instance of the UserPreferencesService.
   * @returns {UserPreferencesService} The singleton instance of the UserPreferencesService.
   */
  static getInstance(): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService();
    }
    return UserPreferencesService.instance;
  }

  /**
   * Creates an entry for the user preferences of a user with an ID
   *
   */
  public async createUserPreferences(newUserPreferencesSpec: UserPreference): Promise<UserPreference> {
    const serviceName = "UserPreferencesService";
    const serviceFunction = "createUserPreferences";
    const method = "POST";
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, this.userPreferencesEndpointUrl);
    let response;
    let responseBody: string;
    const requestBody = JSON.stringify(newUserPreferencesSpec);
    response = await fetchWithAuth(this.userPreferencesEndpointUrl, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: [StatusCodes.CREATED, StatusCodes.NOT_FOUND],
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to create new user preferences for user with id ${newUserPreferencesSpec.user_id}`,
      body: requestBody,
    });
    responseBody = await response.text();

    // check if the server responded with the expected status code
    if (response.status !== StatusCodes.CREATED) {
      // Server responded with a status code that indicates that the resource was not the expected one
      // The responseBody should be an ErrorResponse but that is not guaranteed e.g. if a gateway in the middle returns a 502,
      // or if the server is not conforming to the error response schema
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.API_ERROR,
        `Failed to create new user preferences for user with id ${newUserPreferencesSpec.user_id}`,
        responseBody
      );
    }

    // check if the response is in the expected format
    const responseContentType = response.headers.get("Content-Type");
    if (!responseContentType?.includes("application/json")) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_HEADER,
        "Response Content-Type should be 'application/json'",
        `Content-Type header was ${responseContentType}`
      );
    }

    let userPreferencesResponse: UserPreference;
    try {
      userPreferencesResponse = {
        ...JSON.parse(responseBody),
        accepted_tc: new Date(JSON.parse(responseBody).accepted_tc),
      };
    } catch (e: any) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          responseBody,
          error: e,
        }
      );
    }

    // store the user preferences in the local storage
    PersistentStorageService.setUserPreferences(userPreferencesResponse);

    return {
      ...userPreferencesResponse,
      accepted_tc: new Date(userPreferencesResponse.accepted_tc),
    };
  }

  /**
   * Gets the user preferences of a user with an ID
   *
   */
  public async getUserPreferences(userId: string): Promise<UserPreference> {
    const serviceName = "UserPreferencesService";
    const serviceFunction = "getUserPreferences";
    const method = "GET";
    const errorFactory = getServiceErrorFactory(
      serviceName,
      serviceFunction,
      method,
      `${this.userPreferencesEndpointUrl}?user_id=${userId}`
    );
    let response;
    response = await fetchWithAuth(`${this.userPreferencesEndpointUrl}?user_id=${userId}`, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: [StatusCodes.OK, StatusCodes.NOT_FOUND],
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to get user preferences for user with id ${userId}`,
    });

    // check if the server responded with the expected status code
    const responseBody = await response.text();
    if (response.status !== StatusCodes.OK) {
      // Server responded with a status code that indicates that the resource was not the expected one
      // The responseBody should be an ErrorResponse but that is not guaranteed e.g. if a gateway in the middle returns a 502,
      // or if the server is not conforming to the error response schema
      // we dont want to throw an error however, since the user might not have any preferences yet
      // in that case we return an empty object
      if (response.status === StatusCodes.NOT_FOUND) {
        return {} as UserPreference;
      } else {
        throw errorFactory(
          response.status,
          ErrorConstants.ErrorCodes.API_ERROR,
          `Failed to get user preferences for user with id ${userId}`,
          responseBody
        );
      }
    }
    // check if the response is in the expected format
    const responseContentType = response.headers.get("Content-Type");
    if (!responseContentType?.includes("application/json")) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_HEADER,
        "Response Content-Type should be 'application/json'",
        `Content-Type header was ${responseContentType}`
      );
    }

    let userPreferencesResponse: UserPreference;
    try {
      userPreferencesResponse = {
        ...JSON.parse(responseBody),
        accepted_tc: new Date(JSON.parse(responseBody).accepted_tc),
      };
    } catch (e: any) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          responseBody,
          error: e,
        }
      );
    }

    // store the user preferences in the local storage
    PersistentStorageService.setUserPreferences(userPreferencesResponse);

    return {
      ...userPreferencesResponse,
      accepted_tc: new Date(userPreferencesResponse.accepted_tc),
    };
  }
}
