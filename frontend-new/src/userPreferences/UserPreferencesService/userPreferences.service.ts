import { getRestAPIErrorFactory, RestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { CreateUserPreferencesSpec, UpdateUserPreferencesSpec, UserPreference } from "./userPreferences.types";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { getBackendUrl } from "src/envService";
import { customFetch } from "src/utils/customFetch/customFetch";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { v4 as UUIDV4 } from "uuid";

export default class UserPreferencesService {
  private static instance: UserPreferencesService;
  static serviceName = "UserPreferencesService";

  readonly userPreferencesEndpointUrl: string;
  readonly apiServerUrl: string;

  private constructor() {
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
   * @param response
   * @param userId
   * @param errorFactory
   * @private
   */
  private async parseJsonResponse(response: Response, userId: string, errorFactory: RestAPIErrorFactory): Promise<UserPreference> {
    // parse the response body
    let userPreferencesResponse: UserPreference;
    try {
      // TODO: we should not be accepting the json payload as passed here without validation
      // we should at least validate the types are as expected i.e if(!jsonPayload.sessions instanceof Array ...)
      const jsonPayload: UserPreference = JSON.parse(await response.text());
      userPreferencesResponse = {
        user_id: userId,
        language: jsonPayload.language,
        client_id: jsonPayload.client_id,
        sessions: jsonPayload.sessions,
        sensitive_personal_data_requirement: jsonPayload.sensitive_personal_data_requirement,
        has_sensitive_personal_data: jsonPayload.has_sensitive_personal_data,
        accepted_tc: this.formatAcceptedTC(jsonPayload.accepted_tc),
        user_feedback_answered_questions: jsonPayload.user_feedback_answered_questions,
        experiments: jsonPayload.experiments
      };
    } catch (error) {
      throw errorFactory(
        StatusCodes.UNPROCESSABLE_ENTITY,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Failed to parse response body",
        response
      );
    }
    return userPreferencesResponse;
  }

  /**
   * Creates an entry for the user preferences of a user with an ID.
   * This is used to create a user profile for the first time.
   * you provide user_id and invitation_code
   * @returns {Promise<UserPreference>} The user preferences object
   * @throws {RestAPIError} If the user preferences are invalid
   */
  async createUserPreferences(user_preferences: CreateUserPreferencesSpec): Promise<UserPreference> {
    const serviceName = UserPreferencesService.serviceName;
    const serviceFunction = "createUserPreferences";
    const method = "POST";
    const errorFactory = getRestAPIErrorFactory(
      serviceName,
      serviceFunction,
      method,
      this.userPreferencesEndpointUrl
    );
    const requestBody = JSON.stringify({
      ...user_preferences,
      client_id: this.getClientID(),
    });
    const response = await customFetch(this.userPreferencesEndpointUrl, {
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
    return await this.parseJsonResponse(response, user_preferences.user_id, errorFactory);
  }

  /**
   * Creates an entry for the user preferences of a user with an ID
   * @returns {Promise<UserPreference>} The user preferences object
   * @throws {RestAPIError} If the user preferences are invalid
   */
  async updateUserPreferences(newUserPreferencesSpec: UpdateUserPreferencesSpec): Promise<UserPreference> {
    const serviceName = UserPreferencesService.serviceName;
    const serviceFunction = "updateUserPreferences";
    const method = "PATCH";
    const errorFactory = getRestAPIErrorFactory(
      serviceName,
      serviceFunction,
      method,
      this.userPreferencesEndpointUrl
    );

    const requestBody = JSON.stringify(newUserPreferencesSpec);
    const response = await customFetch(this.userPreferencesEndpointUrl, {
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

    return await this.parseJsonResponse(response, newUserPreferencesSpec.user_id, errorFactory);
  }

  /**
   * Gets the user preferences of a user with an ID
   * @returns {Promise<UserPreference>} The user preferences object
   * @throws {RestAPIError} If the user preferences are invalid or the user does not exist
   */
  async getUserPreferences(userId: string): Promise<UserPreference> {
    const serviceName = UserPreferencesService.serviceName;
    const serviceFunction = "getUserPreferences";
    const method = "GET";
    const qualifiedURL = `${this.userPreferencesEndpointUrl}?user_id=${userId}`;
    const errorFactory = getRestAPIErrorFactory("UserPreferencesService", "getUserPreferences", method, qualifiedURL);

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

    const userPreferences = await this.parseJsonResponse(response, userId, errorFactory);

    const clientId = this.getClientID();

    // If the user preferences do not have a client_id, we will set it to the current client ID.
    // Or if the client_id has changed.
    // This can happen if the user is opening the app on a different device or browser.
    // We will update the user preferences with the current client ID.
    if(!userPreferences.client_id || userPreferences.client_id !== clientId) {
      await this.updateUserPreferences({ user_id: userId, client_id: clientId })
    }

    return userPreferences;
  }

  /**
   * Get a new session ID from the chat service.
   * @returns {Promise<UserPreference>} The user preferences object
   * @throws {RestAPIError} If the user preferences are invalid
   */
  async getNewSession(userId: string): Promise<UserPreference> {
    const serviceName = UserPreferencesService.serviceName;
    const serviceFunction = "getNewSession";
    const method = "GET";
    const qualifiedURL = `${this.userPreferencesEndpointUrl}/new-session?user_id=${userId}`;

    const errorFactory = getRestAPIErrorFactory("UserPreferencesService", "getNewSession", method, qualifiedURL);

    const response = await customFetch(qualifiedURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.CREATED,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to generate new session`,
      expectedContentType: "application/json",
    });

    return await this.parseJsonResponse(response, userId, errorFactory);
  }

  /**
   * Gets the client ID. If it doesn't exist, it will be created.
   *
   * @returns {string} The client ID.
   */
  public getClientID(): string {
    let clientId = PersistentStorageService.getClientId();

    if(!clientId) {
      clientId = UUIDV4()
      PersistentStorageService.setClientID(clientId);
    }

    return clientId;
  }
}
