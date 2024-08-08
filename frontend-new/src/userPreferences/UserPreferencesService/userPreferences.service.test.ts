// mute the console output
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
    expect(service.userPreferencesEndpointUrl).toEqual(`${givenApiServerUrl}/users/preferences`);
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
        }
      );

      // AND expect it to return the user preferences
      expect(actualUserPreferences).toEqual(givenResponseBody);

      // AND expect the service to have set the user preferences in the persistent storage
      expect(PersistentStorageService.setUserPreferences).toHaveBeenCalledWith(givenResponseBody);
    });

    test("on 404, getUserPreferences should return an empty object", async () => {
      // GIVEN the GET models REST API will respond with NOT FOUND
      setupFetchSpy(StatusCodes.NOT_FOUND, undefined, "");

      // WHEN the getUserPreferences function is called
      const service = new UserPreferencesService();
      const actualUserPreferences = await service.getUserPreferences("1");

      // THEN expect it to return an empty object
      expect(actualUserPreferences).toEqual({});
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
        await service.getUserPreferences("1");
      } catch (err) {
        error = err;
      }
      // AND expect the service to throw the error that the fetchWithAuth function throws
      expect(error).toMatchObject(givenFetchError);
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, getUserPreferences should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (description, givenResponse) => {
        // GIVEN the GET models REST API will respond with OK and some response that does conform to the userPreferencesResponseSchema even if it states that it is application/json
        setupFetchSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN the getAllModels function is called
        const service = new UserPreferencesService();
        // THEN expect it to reject with the error response
        const expectedError = {
          ...new ServiceError(
            UserPreferencesService.name,
            "getUserPreferences",
            "GET",
            `${givenApiServerUrl}/users/preferences?user_id=1`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
        };
        let error;
        try {
          await service.getUserPreferences("1");
        } catch (err) {
          error = err;
        }
        expect(error).toMatchObject(expectedError);
        // AND expect error to be service error
        expect(error).toBeInstanceOf(ServiceError);
      }
    );
  });

  describe("createUserPreferences", () => {
    test("should fetch the correct URL, with POST and the correct headers and payload successfully", async () => {
      // GIVEN some user preference specification to create
      const givenUserPreferencesSpec: UserPreference = {
        user_id: "foo",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [],
      };
      // AND the create model REST API will respond with OK and some newly create model
      const expectedUserPreferenceResponse = {
        ...givenUserPreferencesSpec,
        sessions: [1234],
      } as unknown as UserPreference;
      const fetchSpy = setupFetchSpy(
        StatusCodes.CREATED,
        expectedUserPreferenceResponse,
        "application/json;charset=UTF-8"
      );

      // WHEN the createUserPreferences function is called with the given arguments
      const service = new UserPreferencesService();

      const actualCreatedModel = await service.createUserPreferences(givenUserPreferencesSpec);
      // THEN expect it to make a POST request
      // AND the headers
      // AND the request payload to contain the given arguments (name, description, ...)
      expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/users/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(givenUserPreferencesSpec),
        expectedStatusCode: [201, 404],
        failureMessage: `Failed to create new user preferences for user with id ${givenUserPreferencesSpec.user_id}`,
        serviceName: "UserPreferencesService",
        serviceFunction: "createUserPreferences",
      });

      // AND returns the newly created user preferences
      expect(actualCreatedModel).toEqual(expectedUserPreferenceResponse);

      // AND expect the service to have set the user preferences in the persistent storage
      expect(PersistentStorageService.setUserPreferences).toHaveBeenCalledWith(expectedUserPreferenceResponse);
    });

    test("on fail to fetch, it should reject with the expected service error", async () => {
      const givenUserPreferencesSpec: UserPreference = {
        user_id: "1",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [],
      };
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error();
      jest.spyOn(require("src/utils/fetchWithAuth/fetchWithAuth"), "fetchWithAuth").mockRejectedValue(givenFetchError);
      // WHEN calling create model function
      const service = new UserPreferencesService();

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.createUserPreferences(givenUserPreferencesSpec)).rejects.toMatchObject(givenFetchError);
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 201, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (description, givenResponse) => {
        // GIVEN some user preference specification to create
        const givenUserPreferencesSpec: UserPreference = {
          user_id: "1",
          language: Language.en,
          accepted_tc: new Date(),
          sessions: [],
        };
        // AND the create model REST API will respond with OK and some response that does conform to the userPreferencesResponseSchema even if it states that it is application/json
        setupFetchSpy(StatusCodes.CREATED, givenResponse, "application/json;charset=UTF-8");

        // WHEN the createModel function is called with the given arguments (name, description, ...)
        const service = new UserPreferencesService();
        const createModelPromise = service.createUserPreferences(givenUserPreferencesSpec);

        // THEN expected it to reject with the error response
        const expectedError = {
          ...new ServiceError(
            UserPreferencesService.name,
            "createUserPreferences",
            "POST",
            `${givenApiServerUrl}/users/preferences`,
            StatusCodes.CREATED,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
        };
        await expect(createModelPromise).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("getNewSessionId", () => {
    test("getNewSessionId should fetch at the correct URL with GET and the correct headers and payload successfully", async () => {
      // GIVEN a successful response from the getNewSessionId REST API
      const givenResponseBody: UserPreference = {
        user_id: "1",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [1236, 1234],
      };

      const fetchSpy = setupFetchSpy(StatusCodes.OK, givenResponseBody, "application/json;charset=UTF-8");

      // WHEN the getUserPreferences function is called with the given arguments
      const service = new UserPreferencesService();

      const actualUserPreferences = await service.getNewSession(givenResponseBody.user_id);

      // THEN expect it to make a GET request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/users/preferences/new-session?user_id=${givenResponseBody.user_id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          expectedContentType: "application/json",
          expectedStatusCode: 201,
          failureMessage: `Failed to generate new session`,
          serviceFunction: "getNewSession",
          serviceName: "UserPreferencesService",
        }
      );

      // AND expect it to return the user preferences
      expect(actualUserPreferences).toEqual(givenResponseBody);

      // AND expect the service to have set the user preferences in the persistent storage
      expect(PersistentStorageService.setUserPreferences).toHaveBeenCalledWith(givenResponseBody);
    });

    test("on fail to fetch, getNewSessionId should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error();
      jest.spyOn(require("src/utils/fetchWithAuth/fetchWithAuth"), "fetchWithAuth").mockRejectedValue(givenFetchError);

      // WHEN calling getNewSessionId function with some user id
      const service = new UserPreferencesService();

      // THEN expected it to reject with the error response
      let error: any;
      try {
        await service.getNewSession("1");
      } catch (err) {
        error = err;
      }

      // AND expect the service to throw the error that the fetchWithAuth function throws
      expect(error.details.error).toMatchObject(givenFetchError);
      expect(error.message).toBe("Failed to generate new session");
    });
  });
});
