import { StatusCodes } from "http-status-codes/";
import { expectCorrectFetchRequest, setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import authStateService from "src/auth/services/AuthenticationState.service";
import {
  FeedbackItem,
  FeedbackRequest,
  FeedbackResponse,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import InfoService from "src/info/info.service";

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
      getToken: jest.fn().mockReturnValue("foo token"),
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

describe("OverallFeedbackService", () => {
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
    // clear all method mocks
    resetAllMethodMocks(InfoService.getInstance());
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should return a new instance of OverallFeedbackService with the correct sessionId", () => {
    // WHEN calling getInstance
    const instance = OverallFeedbackService.getInstance();

    // THEN expect it to return a new instance of OverallFeedbackService
    expect(instance).toBeInstanceOf(OverallFeedbackService);
  });

  describe("sendFeedback", () => {
    test("should fetch the correct URL, with PATCH and the correct headers and payload successfully", async () => {
      // GIVEN feedback data
      const givenFeedbackData: FeedbackItem[] = [
        {
          question_id: "1",
          simplified_answer: {
            rating_numeric: 5,
            rating_boolean: false,
            selected_options_keys: [],
            comment: "This is a comment",
          },
        },
      ];
      // AND the info service will return the correct version
      const givenFrontendInfoData = {
        date: "fooFrontend",
        branch: "barFrontend",
        buildNumber: "bazFrontend",
        sha: "gooFrontend",
      };
      const givenBackendInfoData = {
        date: "fooBackend",
        branch: "barBackend",
        buildNumber: "bazBackend",
        sha: "gooBackend",
      };
      jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
        frontend: givenFrontendInfoData,
        backend: givenBackendInfoData,
      });
      // AND the REST API will respond with CREATED status
      const expectedResponse: FeedbackResponse = {
        id: "1234",
        version: {
          frontend: "foo-1234",
          backend: "bar-5678",
        },
        feedback_items: givenFeedbackData,
        created_at: new Date().toISOString(),
      };
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, expectedResponse, "application/json;charset=UTF-8");

      // WHEN the sendFeedback method is called
      const givenSessionId = 1234;
      const service = OverallFeedbackService.getInstance();
      const actualResponse = await service.sendFeedback(givenSessionId, givenFeedbackData);

      // THEN expect it to make a PATCH request with correct headers and payload
      const expectedFeedbackRequest: FeedbackRequest = {
        version: {
          frontend: `${givenFrontendInfoData.branch}-${givenFrontendInfoData.buildNumber}`,
        },
        feedback_items_specs: givenFeedbackData,
      };
      expectCorrectFetchRequest(fetchSpy, `${givenApiServerUrl}/conversations/${givenSessionId}/feedback`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expectedFeedbackRequest),
        expectedStatusCode: StatusCodes.OK,
        serviceName: "OverallFeedbackService",
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
      // AND the info service will return the correct version
      const givenFrontendInfoData = {
        date: "fooFrontend",
        branch: "barFrontend",
        buildNumber: "bazFrontend",
        sha: "gooFrontend",
      };
      const givenBackendInfoData = {
        date: "fooBackend",
        branch: "barBackend",
        buildNumber: "bazBackend",
        sha: "gooBackend",
      };
      jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
        frontend: givenFrontendInfoData,
        backend: givenBackendInfoData,
      });

      // WHEN calling sendFeedback method
      const givenSessionId = 1234;
      const service = OverallFeedbackService.getInstance();

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.sendFeedback(givenSessionId, [])).rejects.toMatchObject(givenFetchError);
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, givenResponse) => {
        // GIVEN fetch resolves with a response that has invalid JSON
        setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");
        // AND the info service will return the correct version
        const givenFrontendInfoData = {
          date: "fooFrontend",
          branch: "barFrontend",
          buildNumber: "bazFrontend",
          sha: "gooFrontend",
        };
        const givenBackendInfoData = {
          date: "fooBackend",
          branch: "barBackend",
          buildNumber: "bazBackend",
          sha: "gooBackend",
        };
        jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
          frontend: givenFrontendInfoData,
          backend: givenBackendInfoData,
        });
        // WHEN the sendFeedback method is called
        const givenSessionId = 1234;
        const service = OverallFeedbackService.getInstance();
        const sendFeedbackPromise = service.sendFeedback(givenSessionId, []);

        // THEN expect it to reject with the expected error
        const expectedError = {
          ...new RestAPIError(
            "OverallFeedbackService",
            "sendFeedback",
            "PATCH",
            `${givenApiServerUrl}/conversations/${givenSessionId}/feedback`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          cause: expect.anything(),
        };
        await expect(sendFeedbackPromise).rejects.toMatchObject(expectedError);
      }
    );

    test("should throw an error if user ID is not found", async () => {
      // Mock the authStateService to return a user without an ID
      // @ts-ignore
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue({ id: null });
      // AND the info service will return the correct version
      const givenFrontendInfoData = {
        date: "fooFrontend",
        branch: "barFrontend",
        buildNumber: "bazFrontend",
        sha: "gooFrontend",
      };
      const givenBackendInfoData = {
        date: "fooBackend",
        branch: "barBackend",
        buildNumber: "bazBackend",
        sha: "gooBackend",
      };
      jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
        frontend: givenFrontendInfoData,
        backend: givenBackendInfoData,
      });

      // GIVEN feedback data
      const givenFeedbackData: FeedbackItem[] = [
        {
          question_id: "1",
          simplified_answer: {
            rating_numeric: 5,
            rating_boolean: false,
            selected_options_keys: [],
            comment: "This is a comment",
          },
        },
      ];

      // WHEN the sendFeedback method is called
      const givenSessionId = 1234;
      const service = OverallFeedbackService.getInstance();

      // THEN expect it to throw an error
      await expect(service.sendFeedback(givenSessionId, givenFeedbackData)).rejects.toThrow("User not found");
    });
  });
});
