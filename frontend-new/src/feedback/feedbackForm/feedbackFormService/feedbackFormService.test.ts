import { StatusCodes } from "http-status-codes/";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { ServiceError } from "src/error/ServiceError/ServiceError";
import FeedbackService from "src/feedback/feedbackForm/feedbackFormService/feedbackFormService";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import authStateService from "src/auth/services/AuthenticationState.service";

// mock the user preferences service
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => {
  const mockUserPreference: UserPreference = {
    user_id: "001",
    language: "en",
    accepted_tc: new Date(),
    sessions: [1234],
  } as UserPreference;
  return {
    __esModule: true,
    PersistentStorageService: {
      getUserPreferences: jest.fn().mockReturnValue(JSON.stringify(mockUserPreference)),
    },
  };
});

// mock the authentication state service
jest.mock("src/auth/services/AuthenticationState.service", () => {
  return {
    __esModule: true,
    default: {
      getInstance: jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue({ id: "001" }),
      }),
    },
  };
});

// mock the info service
jest.mock("src/info/info.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        loadInfo: jest.fn().mockReturnValue([{ branch: "foo", buildNumber: "1234" }]),
      };
    }),
  };
});

describe("FeedbackFormService", () => {
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should construct the service successfully", () => {
    // GIVEN the service
    const givenSessionId = 1234;
    const service = new FeedbackService(givenSessionId);

    // THEN expect the service to be constructed successfully
    expect(service).toBeDefined();

    // AND the service should have the correct endpoint url
    expect(service.feedbackEndpointUrl).toEqual(`${givenApiServerUrl}/users/feedback`);
  });

  test("should return a new instance of FeedbackService with the correct sessionId", () => {
    // GIVEN a sessionId
    const sessionId = 1234;

    // WHEN calling getInstance
    const instance = FeedbackService.getInstance(sessionId);

    // THEN expect it to return a new instance of FeedbackService
    expect(instance).toBeInstanceOf(FeedbackService);
    // AND the instance should have the correct sessionId
    expect(instance).toHaveProperty("sessionId", sessionId);
  });

  describe("sendFeedback", () => {
    test("should fetch the correct URL, with POST and the correct headers and payload successfully", async () => {
      // GIVEN feedback data
      const givenFeedbackData = [
        {
          question_id: "1",
          answer: {
            rating_numeric: 5,
            rating_boolean: false,
            selected_options: [],
            comment: "This is a comment",
          },
          is_answered: true,       },
      ];
      // AND the REST API will respond with CREATED status
      const expectedResponse = {
        user_id: "001",
        session_id: 1234,
        version: {
          frontend: "foo-1234",
        },
        feedback: givenFeedbackData,
      };
      const fetchSpy = setupAPIServiceSpy(StatusCodes.CREATED, expectedResponse, "application/json;charset=UTF-8");

      // WHEN the sendFeedback method is called
      const givenSessionId = 1234;
      const service = new FeedbackService(givenSessionId);
      const actualResponse = await service.sendFeedback(givenFeedbackData);

      // THEN expect it to make a POST request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/users/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expectedResponse),
        expectedStatusCode: StatusCodes.CREATED,
        serviceName: "FeedbackService",
        serviceFunction: "sendFeedback",
        failureMessage: `Failed to send feedback with session id ${givenSessionId}`,
        expectedContentType: "application/json",
      });

      // AND expect it to return the valid feedback object
      expect(actualResponse).toEqual(expectedResponse);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN calling sendFeedback method
      const givenSessionId = 1234;
      const service = new FeedbackService(givenSessionId);

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.sendFeedback([])).rejects.toMatchObject(givenFetchError);
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 201, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, givenResponse) => {
        // GIVEN fetch resolves with a response that has invalid JSON
        setupAPIServiceSpy(StatusCodes.CREATED, givenResponse, "application/json;charset=UTF-8");

        // WHEN the sendFeedback method is called
        const givenSessionId = 1234;
        const service = new FeedbackService(givenSessionId);
        const sendFeedbackPromise = service.sendFeedback([]);

        // THEN expect it to reject with the expected error
        const expectedError = {
          ...new ServiceError(
            "FeedbackService",
            "sendFeedback",
            "POST",
            `${givenApiServerUrl}/users/feedback`,
            StatusCodes.CREATED,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
        };
        await expect(sendFeedbackPromise).rejects.toMatchObject(expectedError);
      }
    );

    test("should throw an error if user ID is not found", async () => {
      // Mock the authStateService to return a user without an ID
      // @ts-ignore
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue({ id: null });

      // GIVEN feedback data
      const givenFeedbackData = [
        {
          question_id: "1",
          answer: {
            rating_numeric: 5,
            rating_boolean: false,
            selected_options: [],
            comment: "This is a comment",
          },
          is_answered: true
        },
      ];

      // WHEN the sendFeedback method is called
      const givenSessionId = 1234;
      const service = new FeedbackService(givenSessionId);

      // THEN expect it to throw an error
      await expect(service.sendFeedback(givenFeedbackData)).rejects.toThrow("User not found");
    });

  });
});
