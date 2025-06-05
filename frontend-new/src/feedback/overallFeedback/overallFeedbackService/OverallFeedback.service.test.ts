import { StatusCodes } from "http-status-codes/";
import { expectCorrectFetchRequest, setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import authStateService from "src/auth/services/AuthenticationState.service";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import {
  FeedbackItem, FeedbackRequest, FeedbackResponse,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import InfoService from "src/info/info.service";
import { TabiyaUser } from "src/auth/auth.types";
import "src/_test_utilities/consoleMock";
import { QuestionsConfig, QuestionType } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";

// mock the authentication state service
jest.mock("src/auth/services/AuthenticationState.service", () => {
  return {
    __esModule: true, default: {
      getInstance: jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue({ id: "001" }), getToken: jest.fn().mockReturnValue("foo token"),
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
    resetAllMethodMocks(AuthenticationStateService.getInstance());
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
      const givenFeedbackData: FeedbackItem[] = [{
        question_id: "1", simplified_answer: {
          rating_numeric: 5, rating_boolean: false, selected_options_keys: [], comment: "This is a comment",
        },
      }];
      // AND the authentication state service returns a user with an ID
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue({ id: "001" } as unknown as TabiyaUser);
      // AND the info service will return the correct version
      const givenFrontendInfoData = {
        date: "fooFrontend", branch: "barFrontend", buildNumber: "bazFrontend", sha: "gooFrontend",
      };
      const givenBackendInfoData = {
        date: "fooBackend", branch: "barBackend", buildNumber: "bazBackend", sha: "gooBackend",
      };
      jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
        frontend: givenFrontendInfoData, backend: givenBackendInfoData,
      });
      // AND the REST API will respond with CREATED status
      const expectedResponse: FeedbackResponse = {
        id: "1234", version: {
          frontend: "foo-1234", backend: "bar-5678",
        }, feedback_items: givenFeedbackData, created_at: new Date().toISOString(),
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
        }, feedback_items_specs: givenFeedbackData,
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
      // AND the authentication state service returns a user with an ID
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue({ id: "001" } as unknown as TabiyaUser);
      // AND the info service will return the correct version
      const givenFrontendInfoData = {
        date: "fooFrontend", branch: "barFrontend", buildNumber: "bazFrontend", sha: "gooFrontend",
      };
      const givenBackendInfoData = {
        date: "fooBackend", branch: "barBackend", buildNumber: "bazBackend", sha: "gooBackend",
      };
      jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
        frontend: givenFrontendInfoData, backend: givenBackendInfoData,
      });

      // WHEN calling sendFeedback method
      const givenSessionId = 1234;
      const service = OverallFeedbackService.getInstance();

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.sendFeedback(givenSessionId, [])).rejects.toMatchObject(givenFetchError);
    });

    test("should fail with user not found if the authentication state service doesnt return a user with an ID", async () => {
      // GIVEN the authentication state service returns a user without an ID
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue({ id: null } as unknown as TabiyaUser);

      // WHEN calling sendFeedback method
      const givenSessionId = 1234;
      const service = OverallFeedbackService.getInstance();

      // THEN expected it to reject with user not found error
      await expect(service.sendFeedback(givenSessionId, [])).rejects.toThrow(new Error("User not found"));
    });

    test.each([["is a malformed json", "{"], ["is a string", "foo"]])("on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s", async (_description, givenResponse) => {
      // GIVEN fetch resolves with a response that has invalid JSON
      setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");
      // AND the authentication state service returns a user with an ID
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue({ id: "001" } as unknown as TabiyaUser);

      // AND the info service will return the correct version
      const givenFrontendInfoData = {
        date: "fooFrontend", branch: "barFrontend", buildNumber: "bazFrontend", sha: "gooFrontend",
      };
      const givenBackendInfoData = {
        date: "fooBackend", branch: "barBackend", buildNumber: "bazBackend", sha: "gooBackend",
      };
      jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
        frontend: givenFrontendInfoData, backend: givenBackendInfoData,
      });
      // WHEN the sendFeedback method is called
      const givenSessionId = 1234;
      const service = OverallFeedbackService.getInstance();
      const sendFeedbackPromise = service.sendFeedback(givenSessionId, []);

      // THEN expect it to reject with the expected error
      const expectedError = {
        ...new RestAPIError("OverallFeedbackService", "sendFeedback", "PATCH", `${givenApiServerUrl}/conversations/${givenSessionId}/feedback`, StatusCodes.OK, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "", ""),
        cause: expect.anything(),
      };
      await expect(sendFeedbackPromise).rejects.toMatchObject(expectedError);
    });

    test("should throw an error if user ID is not found", async () => {
      // Mock the authStateService to return a user without an ID
      // @ts-ignore
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue({ id: null });
      // AND the info service will return the correct version
      const givenFrontendInfoData = {
        date: "fooFrontend", branch: "barFrontend", buildNumber: "bazFrontend", sha: "gooFrontend",
      };
      const givenBackendInfoData = {
        date: "fooBackend", branch: "barBackend", buildNumber: "bazBackend", sha: "gooBackend",
      };
      jest.spyOn(InfoService.getInstance(), "loadInfo").mockResolvedValueOnce({
        frontend: givenFrontendInfoData, backend: givenBackendInfoData,
      });

      // GIVEN feedback data
      const givenFeedbackData: FeedbackItem[] = [{
        question_id: "1", simplified_answer: {
          rating_numeric: 5, rating_boolean: false, selected_options_keys: [], comment: "This is a comment",
        },
      }];

      // WHEN the sendFeedback method is called
      const givenSessionId = 1234;
      const service = OverallFeedbackService.getInstance();

      // THEN expect it to throw an error
      await expect(service.sendFeedback(givenSessionId, givenFeedbackData)).rejects.toThrow("User not found");
    });
  });

  describe("getQuestionsConfig", () => {
    test("should fetch questions config successfully", async () => {
      // GIVEN a questions config response from the backend
      const givenQuestionsConfig: QuestionsConfig = {
        perceived_bias: {
          questionId: "perceived_bias",
          question_text: "foo",
          description: "bar",
          comment_placeholder: "baz",
          type: QuestionType.YesNo,
          show_comments_on: "yes",
        },
      } as unknown as QuestionsConfig;

      // given a session id
      const givenSessionId = 1234;

      // AND the GET request will respond with OK and the questions config
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenQuestionsConfig, "application/json;charset=UTF-8");

      // WHEN the getQuestionsConfig function is called
      const service = OverallFeedbackService.getInstance();
      const actualQuestionsConfig = await service.getQuestionsConfig(givenSessionId);

      // THEN expect it to make a GET request with correct headers
      expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/conversations/${givenSessionId}/feedback/questions`, expect.objectContaining({
        expectedContentType: "application/json",
        expectedStatusCode: 200,
        headers: { "Content-Type": "application/json" },
        method: "GET",
      }));


      // AND expect the response to be the expected questions config
      expect(actualQuestionsConfig).toEqual(givenQuestionsConfig);
    });

    test("should throw an error if the response is not valid JSON", async () => {
      // GIVEN the GET request will respond with OK but invalid JSON
      setupAPIServiceSpy(StatusCodes.OK, "invalid json", "application/json;charset=UTF-8");

      // given a session id
      const givenSessionId = 1234;

      // WHEN the getQuestionsConfig function is called
      const service = OverallFeedbackService.getInstance();
      let error: Error | undefined;
      try {
        await service.getQuestionsConfig(givenSessionId);
      } catch (e) {
        error = e as Error;
      }

      // THEN expect an error to have been thrown
      expect(error).toBeDefined();
      expect(error?.message).toContain("Response did not contain valid JSON");
    });
  });
});
