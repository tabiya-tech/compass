import "src/_test_utilities/consoleMock";

import UserPreferencesService from "./userPreferences.service";
import { StatusCodes } from "http-status-codes";
import { ServiceError } from "src/error/ServiceError/ServiceError";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import {
  CreateUserPreferencesSpec,
  Language,
  UpdateUserPreferencesSpec,
  UserPreference,
} from "./userPreferences.types";

const setupFetchSpy = setupAPIServiceSpy;

// mock the persistent storage service
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => {
  return {
    __esModule: true,
    PersistentStorageService: {
      setUserPreferences: jest.fn(),
    },
  };
});

describe("UserPreferencesService", () => {
  // GIVEN a backend URL is returned by the envService
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("should construct the service successfully", () => {
    // GIVEN  the service is constructed
    const service = new UserPreferencesService();

    // THEN expect the service to be constructed successfully
    expect(service).toBeDefined();

    // AND the service should have the correct endpoint url
    expect(service.getUserPreferencesEndpointUrl).toEqual(`${givenApiServerUrl}/users/preferences`);
  });

  describe("getUserPreferences", () => {
    test("getUserPreferences should fetch at the correct URL, with GET and the correct headers and payload successfully", async () => {
      // AND the GET models REST API will respond with OK and some models
      const givenResponseBody: UserPreference = {
        user_id: "1",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [1234],
      };

      const fetchSpy = setupFetchSpy(StatusCodes.OK, givenResponseBody, "application/json;charset=UTF-8");

      // WHEN the getUserPreferences function is called with the given arguments
      const service = new UserPreferencesService();
      const actualUserPreferences = await service.getUserPreferences(givenResponseBody.user_id);

      // THEN expect it to make a GET request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/users/preferences?user_id=${givenResponseBody.user_id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          expectedStatusCode: [200, 404],
          failureMessage: `Failed to get user preferences for user with id ${givenResponseBody.user_id}`,
          serviceFunction: "getUserPreferences",
          serviceName: "UserPreferencesService",
          expectedContentType: "application/json",
        }
      );

      // AND expect it to return the user preferences
      expect(actualUserPreferences).toEqual(givenResponseBody);
    });

    test("on fail to fetch, getUserPreferences should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("Failed to get user preferences");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockRejectedValue(givenFetchError);

      // WHEN calling getUserPreferences function with some user id
      const service = new UserPreferencesService();

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
      async (description, givenResponse) => {
        // GIVEN the GET invitations REST API will respond with OK and some invalid response
        setupFetchSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN the getUserPreferences function is called with the given user id
        const service = new UserPreferencesService();

        // THEN expected it to reject with the error response
        const expectedError: ServiceError = {
          ...new ServiceError(
            UserPreferencesService.name,
            "getUserPreferences",
            "GET",
            `${givenApiServerUrl}/users/preferences?user_id=1`,
            StatusCodes.UNPROCESSABLE_ENTITY,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
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

      const fetchSpy = setupFetchSpy(StatusCodes.OK, givenUserPreferences, "application/json;charset=UTF-8");

      // WHEN the updateUserPreferences function is called with the given arguments
      const service = new UserPreferencesService();
      const actualUserPreferences = await service.updateUserPreferences(givenUserPreferences);

      // THEN expect it to make a PATCH request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/users/preferences`, {
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
      const service = new UserPreferencesService();

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
      async (description, givenResponse) => {
        // GIVEN the PATCH invitations REST API will respond with OK and some invalid response
        setupFetchSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN the updateUserPreferences function is called with the given user preferences
        const service = new UserPreferencesService();
        const expectedError: ServiceError = {
          ...new ServiceError(
            UserPreferencesService.name,
            "updateUserPreferences",
            "PATCH",
            `${givenApiServerUrl}/users/preferences`,
            StatusCodes.UNPROCESSABLE_ENTITY,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
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

      // WHEN the createUserPreferences function is called with the given arguments
      const mockResponseFormBackend: UserPreference = {
        user_id: givenUserPreferences.user_id,
        language: givenUserPreferences.language,
        sessions: [],
        accepted_tc: undefined,
      };
      const fetchSpy = setupFetchSpy(StatusCodes.CREATED, mockResponseFormBackend, "application/json;charset=UTF-8");

      const service = new UserPreferencesService();
      const actualUserPreferences = await service.createUserPreferences(givenUserPreferences);

      // THEN expect it to make a POST request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/users/preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(givenUserPreferences),
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
        accepted_tc: undefined,
      };

      expect(actualUserPreferences).toEqual(expectedUserPreferences);
    });

    test("on fail to fetch, createUserPreferences should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("Failed to create new user preferences");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockRejectedValue(givenFetchError);

      // WHEN calling createUserPreferences function with some user preferences
      const service = new UserPreferencesService();

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
      async (description, givenResponse) => {
        // GIVEN the POST invitations REST API will respond with CREATED and some invalid response
        setupFetchSpy(StatusCodes.CREATED, givenResponse, "application/json;charset=UTF-8");

        // WHEN the createUserPreferences function is called with the given user preferences
        const service = new UserPreferencesService();
        const expectedError: ServiceError = {
          ...new ServiceError(
            UserPreferencesService.name,
            "createUserPreferences",
            "POST",
            `${givenApiServerUrl}/users/preferences`,
            StatusCodes.UNPROCESSABLE_ENTITY,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
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
