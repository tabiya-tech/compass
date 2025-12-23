import "src/_test_utilities/consoleMock";

import UserPreferencesService from "./userPreferences.service";
import { StatusCodes } from "http-status-codes";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { getRandomString } from "src/_test_utilities/specialCharacters";
import { setupAPIServiceSpy, expectCorrectFetchRequest } from "src/_test_utilities/fetchSpy";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import {
  CreateUserPreferencesSpec,
  SensitivePersonalDataRequirement,
  Language,
  UpdateUserPreferencesSpec,
  UserPreference,
} from "./userPreferences.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

function getTestUserPreferences(): UserPreference {
  return {
    user_id: "1",
    language: Language.en,
    accepted_tc: new Date(),
    sessions: [1234],
    client_id: getRandomString(10),
    user_feedback_answered_questions: {},
    has_sensitive_personal_data: false,
    sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
    experiments: {},
  };
}

describe("UserPreferencesService", () => {
  // GIVEN a backend URL is returned by the envService
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
    jest.clearAllMocks();
  });
  afterEach(() => {
    // Reset all mocks to avoid any side effects between tests
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  test("should get a single instance successfully", () => {
    // WHEN the service is constructed
    const actualFirstInstance = UserPreferencesService.getInstance();

    // THEN expect the service to be constructed successfully
    expect(actualFirstInstance).toBeDefined();

    // AND the service should have the correct endpoint urls
    expect(actualFirstInstance.apiServerUrl).toEqual(givenApiServerUrl);
    expect(actualFirstInstance.userPreferencesEndpointUrl).toEqual(`${givenApiServerUrl}/users/preferences`);

    // AND WHEN the service is constructed again
    const actualSecondInstance = UserPreferencesService.getInstance();

    // THEN expect the second instance to be the same as the first instance
    expect(actualFirstInstance).toBe(actualSecondInstance);
  });

  describe("getUserPreferences", () => {
    test("getUserPreferences should fetch at the correct URL, with GET and the correct headers and payload successfully", async () => {
      // GIVEN the GET models REST API will respond with OK and some models
      const givenResponseBody = getTestUserPreferences();

      // AND the client id is the same as the one on the local client device
      jest.spyOn(PersistentStorageService, "getClientId").mockReturnValue(givenResponseBody.client_id as string);

      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenResponseBody, "application/json;charset=UTF-8");

      // WHEN the getUserPreferences function is called with the given arguments
      const service = UserPreferencesService.getInstance();
      const actualUserPreferences = await service.getUserPreferences(givenResponseBody.user_id);

      // THEN expect it to make a GET request with correct headers and payload
      expectCorrectFetchRequest(
        fetchSpy,
        `${givenApiServerUrl}/users/preferences?user_id=${givenResponseBody.user_id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          expectedStatusCode: [StatusCodes.OK],
          failureMessage: `Failed to get user preferences for user with id ${givenResponseBody.user_id}`,
          serviceFunction: "getUserPreferences",
          serviceName: "UserPreferencesService",
          expectedContentType: "application/json",
        }
      );

      // AND expect it to return the user preferences
      expect(actualUserPreferences).toEqual(givenResponseBody);
    });

    test("getUserPreferences should update the client id in the user preferences if it does not exist for legacy users", async () => {
      const updateUserPreferencesSpy = jest.spyOn(UserPreferencesService.getInstance(), "updateUserPreferences");

      // GIVEN the GET models REST API will respond with OK and some models
      const givenResponseBody: UserPreference = getTestUserPreferences();
      // With no client id
      givenResponseBody.client_id = undefined;

      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenResponseBody, "application/json;charset=UTF-8");

      // AND PersistentStorageService.getClientId returns a client id
      const givenClientId = "client-1234";
      jest.spyOn(PersistentStorageService, "getClientId").mockReturnValue(givenClientId);

      // WHEN the getUserPreferences function is called with the given arguments
      const service = UserPreferencesService.getInstance();
      await service.getUserPreferences(givenResponseBody.user_id);

      // THEN expect it to make a GET request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalled();

      // AND updateUserPreferencesSpy should be called with the correct arguments
      expect(updateUserPreferencesSpy).toHaveBeenCalledWith({
        user_id: givenResponseBody.user_id,
        client_id: givenClientId,
      });
    });

    test("getUserPreferences should update the client id if it mismatches with the one on the local client device", async () => {
      const updateUserPreferencesSpy = jest.spyOn(UserPreferencesService.getInstance(), "updateUserPreferences");

      // GIVEN the GET models REST API will respond with OK and some models
      const givenResponseBody: UserPreference = getTestUserPreferences();
      // With no client id
      givenResponseBody.client_id = getRandomString(10);

      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenResponseBody, "application/json;charset=UTF-8");

      // AND PersistentStorageService.getClientId returns a client id
      const givenClientId = "client-1234";

      // GUARD givenClientId != givenResponseBody.client_id
      expect(givenClientId).not.toEqual(givenResponseBody.client_id);

      jest.spyOn(PersistentStorageService, "getClientId").mockReturnValue(givenClientId);

      // WHEN the getUserPreferences function is called with the given arguments
      const service = UserPreferencesService.getInstance();
      await service.getUserPreferences(givenResponseBody.user_id);

      // THEN expect it to make a GET request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalled();

      // AND updateUserPreferencesSpy should be called with the correct arguments
      expect(updateUserPreferencesSpy).toHaveBeenCalledWith({
        user_id: givenResponseBody.user_id,
        client_id: givenClientId,
      });
    });

    test("on fail to fetch, getUserPreferences should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("Failed to get user preferences");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockRejectedValue(givenFetchError);

      // WHEN calling getUserPreferences function with some user id
      const service = UserPreferencesService.getInstance();

      // THEN expected it to reject with the error response

      const getUserPreferencesCallback = async () => await service.getUserPreferences("1");

      // AND expect the service to throw the error that the fetchWithAuth function throws
      await expect(getUserPreferencesCallback).rejects.toThrow("Failed to get user preferences");
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.API_ERROR if response %s",
      async (_description, givenResponse) => {
        // GIVEN the GET invitations REST API will respond with OK and some invalid response
        setupAPIServiceSpy(StatusCodes.OK, {}, "application/json;charset=UTF-8").mockResolvedValueOnce(givenResponse);

        // WHEN the getUserPreferences function is called with the given user id
        const service = UserPreferencesService.getInstance();

        // THEN expected it to reject with the error response
        const expectedError: RestAPIError = {
          ...new RestAPIError(
            UserPreferencesService.name,
            "getUserPreferences",
            "GET",
            `${givenApiServerUrl}/users/preferences?user_id=1`,
            StatusCodes.UNPROCESSABLE_ENTITY,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          cause: expect.anything(),
        };
        const getUserPreferencesCallback = async () => await service.getUserPreferences("1");

        // THEN expected it to reject with the error response
        await expect(getUserPreferencesCallback).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("updateUserPreferences", () => {
    test("updateUserPreferences should fetch at the correct URL, with PATCH and the correct headers and payload successfully", async () => {
      // AND the PATCH models REST API will respond with OK and some models
      const givenUserPreferences: UpdateUserPreferencesSpec = {
        user_id: "1",
        language: Language.en,
        accepted_tc: new Date(),
      };

      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenUserPreferences, "application/json;charset=UTF-8");

      // WHEN the updateUserPreferences function is called with the given arguments
      const service = UserPreferencesService.getInstance();
      const actualUserPreferences = await service.updateUserPreferences(givenUserPreferences);

      // THEN expect it to make a PATCH request with correct headers and payload
      expectCorrectFetchRequest(fetchSpy, `${givenApiServerUrl}/users/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(givenUserPreferences),
        expectedStatusCode: 200,
        failureMessage: `Failed to update user preferences for user with id ${givenUserPreferences.user_id}`,
        serviceFunction: "updateUserPreferences",
        serviceName: "UserPreferencesService",
        expectedContentType: "application/json",
      });

      // AND expect it to return the user preferences
      expect(actualUserPreferences).toEqual(givenUserPreferences);
    });

    test("on fail to fetch, updateUserPreferences should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("Failed to update user preferences");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockRejectedValue(givenFetchError);

      // WHEN calling updateUserPreferences function with some user preferences
      const service = UserPreferencesService.getInstance();

      // THEN expected it to reject with the error response
      let updateUserPreferencesCallback = async () =>
        await service.updateUserPreferences({
          user_id: "1",
          language: Language.en,
          accepted_tc: new Date(),
        });

      // AND expect the service to throw the error that the fetchWithAuth function throws
      await expect(updateUserPreferencesCallback).rejects.toThrow("Failed to update user preferences");
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.API_ERROR if response %s",
      async (_description, givenResponse) => {
        // GIVEN the PATCH invitations REST API will respond with OK and some invalid response
        setupAPIServiceSpy(StatusCodes.OK, {}, "application/json;charset=UTF-8").mockResolvedValueOnce(givenResponse);

        // WHEN the updateUserPreferences function is called with the given user preferences
        const service = UserPreferencesService.getInstance();
        const expectedError: RestAPIError = {
          ...new RestAPIError(
            UserPreferencesService.name,
            "updateUserPreferences",
            "PATCH",
            `${givenApiServerUrl}/users/preferences`,
            StatusCodes.UNPROCESSABLE_ENTITY,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          cause: expect.anything(),
        };
        const updateUserPreferencesCallback = async () =>
          await service.updateUserPreferences({
            user_id: "1",
            language: Language.en,
            accepted_tc: new Date(),
          });

        // THEN expected it to reject with the error response
        await expect(updateUserPreferencesCallback).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("createUserPreferences", () => {
    test("createUserPreferences should fetch at the correct URL, with POST and the correct headers and payload successfully", async () => {
      // AND the POST models REST API will respond with OK and some models
      const givenUserPreferences: CreateUserPreferencesSpec = {
        user_id: "1",
        language: Language.en,
        invitation_code: "1234",
      };

      // AND a given client id
      const givenClientId = "client-1234";
      jest.spyOn(PersistentStorageService, "getClientId").mockReturnValue(givenClientId);

      // WHEN the createUserPreferences function is called with the given arguments
      const mockResponseFormBackend: UserPreference = {
        user_id: givenUserPreferences.user_id,
        language: givenUserPreferences.language,
        sessions: [],
        user_feedback_answered_questions: {},
        client_id: givenClientId,
        accepted_tc: undefined,
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        experiments: {},
      };
      const fetchSpy = setupAPIServiceSpy(
        StatusCodes.CREATED,
        mockResponseFormBackend,
        "application/json;charset=UTF-8"
      );

      const service = UserPreferencesService.getInstance();
      const actualUserPreferences = await service.createUserPreferences(givenUserPreferences);

      // THEN expect it to make a POST request with correct headers and payload
      expectCorrectFetchRequest(fetchSpy, `${givenApiServerUrl}/users/preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...givenUserPreferences,
          client_id: givenClientId,
        }),
        expectedStatusCode: 201,
        failureMessage: `Failed to create new user preferences for user with id ${givenUserPreferences.user_id}`,
        serviceFunction: "createUserPreferences",
        serviceName: "UserPreferencesService",
        expectedContentType: "application/json",
      });

      // AND expect it to return the user preferences
      const expectedUserPreferences: UserPreference = {
        user_id: givenUserPreferences.user_id,
        language: givenUserPreferences.language,
        sessions: [],
        client_id: givenClientId,
        user_feedback_answered_questions: {},
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        accepted_tc: undefined,
        experiments: {},
      };

      expect(actualUserPreferences).toEqual(expectedUserPreferences);
    });

    test("on fail to fetch, createUserPreferences should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("Failed to create new user preferences");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockRejectedValue(givenFetchError);

      // WHEN calling createUserPreferences function with some user preferences
      const service = UserPreferencesService.getInstance();

      // THEN expected it to reject with the error response
      let createUserPreferencesCallback = async () =>
        await service.createUserPreferences({
          user_id: "1",
          language: Language.en,
          invitation_code: "1234",
        });

      // AND expect the service to throw the error that the fetchWithAuth function throws
      await expect(createUserPreferencesCallback).rejects.toThrow("Failed to create new user preferences");
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 201, should reject with an error ERROR_CODE.API_ERROR if response %s",
      async (_description, givenResponse) => {
        // GIVEN the POST invitations REST API will respond with CREATED and some invalid response
        setupAPIServiceSpy(StatusCodes.CREATED, {}, "application/json;charset=UTF-8").mockResolvedValueOnce(
          givenResponse
        );

        // WHEN the createUserPreferences function is called with the given user preferences
        const service = UserPreferencesService.getInstance();
        const expectedError: RestAPIError = {
          ...new RestAPIError(
            UserPreferencesService.name,
            "createUserPreferences",
            "POST",
            `${givenApiServerUrl}/users/preferences`,
            StatusCodes.UNPROCESSABLE_ENTITY,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          cause: expect.anything(),
        };
        const createUserPreferencesCallback = async () =>
          await service.createUserPreferences({
            user_id: "1",
            language: Language.en,
            invitation_code: "1234",
          });

        // THEN expected it to reject with the error response
        await expect(createUserPreferencesCallback).rejects.toMatchObject(expectedError);
      }
    );
  });
});
