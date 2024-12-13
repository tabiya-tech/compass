import { getServiceErrorFactory, ServiceErrorFactory } from "src/error/ServiceError/ServiceError";
import { CreateUserPreferencesSpec, UpdateUserPreferencesSpec, UserPreference } from "./userPreferences.types";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import { getBackendUrl } from "src/envService";
import { customFetch } from "src/utils/customFetch/customFetch";

export default class UserPreferencesService {
  private static instance: UserPreferencesService;
  static serviceName = "UserPreferencesService";

  readonly updateUserPreferencesEndpointUrl: string;
  readonly getUserPreferencesEndpointUrl: string;
  readonly apiServerUrl: string;
  readonly generateNewSessionEndpointUrl: string;
  readonly createUserPreferencesEndpointURL: string;

  constructor() {
    this.apiServerUrl = getBackendUrl();
    this.getUserPreferencesEndpointUrl = `${this.apiServerUrl}/users/preferences`;
    this.updateUserPreferencesEndpointUrl = `${this.apiServerUrl}/users/preferences`;
    this.createUserPreferencesEndpointURL = `${this.apiServerUrl}/users/preferences`;
    this.generateNewSessionEndpointUrl = `${this.apiServerUrl}/users/preferences/new-session`;
  }

  /**
   * Format the accepted_tc field of the user preferences to a Date object.
   * @param accepted_tc - The accepted_tc field of the user preferences.
   * @returns {Date | null}
   * @private
   */
  private formatAcceptedTC(accepted_tc: string | Date | null | undefined): Date | undefined {
    if (!accepted_tc) {
      return undefined;
    }
    if (typeof accepted_tc === "string") {
      return new Date(accepted_tc);
    }
    return accepted_tc;
  }

  /**
   * Parse the JSON response from the backend into a UserPreference object.
   * @param responseBody
   * @param errorFactory
   * @private
   */
  private parseJsonResponse(responseBody: string, errorFactory: ServiceErrorFactory): UserPreference {
    // parse the response body
    let userPreferencesResponse: UserPreference;
    try {
      const jsonPayload: UserPreference = JSON.parse(responseBody);
      userPreferencesResponse = {
        user_id: jsonPayload.user_id,
        language: jsonPayload.language,
        sessions: jsonPayload.sessions,
        accepted_tc: this.formatAcceptedTC(jsonPayload.accepted_tc),
        sessions_with_feedback: jsonPayload.sessions_with_feedback,
      };
    } catch (error) {
      throw errorFactory(
        StatusCodes.UNPROCESSABLE_ENTITY,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Failed to parse response body",
        responseBody
      );
    }
    return userPreferencesResponse;
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
   * Creates an entry for the user preferences of a user with an ID.
   * This is used to create a user profile for the first time.
   * you provide user_id and invitation_code
   * @returns {Promise<UserPreference>} The user preferences object
   * @throws {ServiceError} If the user preferences are invalid
   */
  async createUserPreferences(user_preferences: CreateUserPreferencesSpec): Promise<UserPreference> {
    const serviceName = UserPreferencesService.serviceName;
    const serviceFunction = "createUserPreferences";
    const method = "POST";
    const errorFactory = getServiceErrorFactory(
      serviceName,
      serviceFunction,
      method,
      this.createUserPreferencesEndpointURL
    );
    const requestBody = JSON.stringify(user_preferences);
    const response = await customFetch(this.createUserPreferencesEndpointURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.CREATED,
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to create new user preferences for user with id ${user_preferences.user_id}`,
      body: requestBody,
      expectedContentType: "application/json",
    });
    const responseBody = await response.text();
    return this.parseJsonResponse(responseBody, errorFactory);
  }

  /**
   * Creates an entry for the user preferences of a user with an ID
   * @returns {Promise<UserPreference>} The user preferences object
   * @throws {ServiceError} If the user preferences are invalid
   */
  async updateUserPreferences(newUserPreferencesSpec: UpdateUserPreferencesSpec): Promise<UserPreference> {
    const serviceName = UserPreferencesService.serviceName;
    const serviceFunction = "updateUserPreferences";
    const method = "PATCH";
    const errorFactory = getServiceErrorFactory(
      serviceName,
      serviceFunction,
      method,
      this.updateUserPreferencesEndpointUrl
    );

    const requestBody = JSON.stringify(newUserPreferencesSpec);
    const response = await customFetch(this.updateUserPreferencesEndpointUrl, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to update user preferences for user with id ${newUserPreferencesSpec.user_id}`,
      body: requestBody,
      expectedContentType: "application/json",
    });
    const responseBody = await response.text();
    return this.parseJsonResponse(responseBody, errorFactory);
  }

  /**
   * Gets the user preferences of a user with an ID
   * @returns {Promise<UserPreference>} The user preferences object
   * @throws {ServiceError} If the user preferences are invalid or the user does not exist
   */
  async getUserPreferences(userId: string): Promise<UserPreference> {
    const serviceName = UserPreferencesService.serviceName;
    const serviceFunction = "getUserPreferences";
    const method = "GET";
    const qualifiedURL = `${this.getUserPreferencesEndpointUrl}?user_id=${userId}`;
    const errorFactory = getServiceErrorFactory("UserPreferencesService", "getUserPreferences", method, qualifiedURL);

    const response = await customFetch(qualifiedURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: [StatusCodes.OK],
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to get user preferences for user with id ${userId}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();
    return this.parseJsonResponse(responseBody, errorFactory);
  }

  /**
   * Get a new session ID from the chat service.
   * @returns {Promise<UserPreference>} The user preferences object
   * @throws {ServiceError} If the user preferences are invalid
   */
  async getNewSession(userId: string): Promise<UserPreference> {
    const serviceName = UserPreferencesService.serviceName;
    const serviceFunction = "getNewSession";
    const method = "GET";
    const qualifiedURL = `${this.generateNewSessionEndpointUrl}?user_id=${userId}`;

    const errorFactory = getServiceErrorFactory("UserPreferencesService", "getUserPreferences", method, qualifiedURL);

    const response = await customFetch(qualifiedURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.CREATED,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to generate new session`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();
    return this.parseJsonResponse(responseBody, errorFactory);
  }
}

export const userPreferencesService = UserPreferencesService.getInstance();
