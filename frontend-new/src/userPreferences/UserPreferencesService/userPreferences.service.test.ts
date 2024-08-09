import "src/_test_utilities/consoleMock";

import UserPreferencesService from "./userPreferences.service";
import { StatusCodes } from "http-status-codes";
import { ServiceError } from "src/error/ServiceError/ServiceError";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import { Language, UserPreference } from "./userPreferences.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

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
      let actualUserPreferences;
      await service.getUserPreferences(
        givenResponseBody.user_id,
        (data) => {
          actualUserPreferences = data;
        },
        (error) => {
          throw error;
        }
      );

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
        }
      );

      // AND expect it to return the user preferences
      expect(actualUserPreferences).toEqual(givenResponseBody);

      // AND expect the service to have set the user preferences in the persistent storage
      expect(PersistentStorageService.setUserPreferences).toHaveBeenCalledWith(givenResponseBody);
    });

    test("on fail to fetch, getUserPreferences should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error();
      jest.spyOn(require("src/utils/fetchWithAuth/fetchWithAuth"), "fetchWithAuth").mockRejectedValue(givenFetchError);

      // WHEN calling getUserPreferences function with some user id
      const service = new UserPreferencesService();

      // THEN expected it to reject with the error response
      let error;
      try {
        await service.getUserPreferences(
          "1",
          () => {},
          (err) => {
            throw err;
          }
        );
      } catch (err) {
        error = err;
      }

      // AND expect the service to throw the error that the fetchWithAuth function throws
      expect(error).toEqual(new Error("Failed to get user preferences for user with id 1"));
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
        const expectedError = {
          ...new ServiceError(
            UserPreferencesService.name,
            "getUserPreferences",
            "GET",
            `${givenApiServerUrl}/users/preferences?user_id=1`,
            StatusCodes.INTERNAL_SERVER_ERROR,
            ErrorConstants.ErrorCodes.API_ERROR,
            "",
            ""
          ),
          details: expect.anything(),
        };
        let error;
        try {
          await service.getUserPreferences(
            "1",
            () => {},
            (err) => {
              throw err;
            }
          );
        } catch (err) {
          error = err;
        }
        expect(error).toMatchObject(expectedError);
        // AND expect error to be service error
        expect(error).toBeInstanceOf(ServiceError);
      }
    );
  });

  describe("updateUserPreferences", () => {
    // Add tests for updateUserPreferences if needed
  });

  describe("getNewSessionId", () => {
    // Add tests for getNewSessionId if needed
  });
});
