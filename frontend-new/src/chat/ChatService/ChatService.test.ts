import "src/_test_utilities/consoleMock";
import { StatusCodes } from "http-status-codes";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { expectCorrectFetchRequest, setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import "src/_test_utilities/envServiceMock";
import {
  generateTestChatResponses,
  generateTestHistory,
} from "src/chat/ChatService/_test_utilities/generateTestChatResponses";
import ChatService from "./ChatService";

describe("ChatService", () => {
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should get a single instance successfully", () => {
    // WHEN the service is constructed
    const actualFirstInstance = ChatService.getInstance();

    expect(actualFirstInstance).toBeDefined();
    expect(actualFirstInstance.apiServerUrl).toEqual(givenApiServerUrl);
    expect(actualFirstInstance.chatEndpointUrl).toEqual(`${givenApiServerUrl}/conversations`);

    const actualSecondInstance = ChatService.getInstance();
    expect(actualFirstInstance).toBe(actualSecondInstance);

    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("sendMessage", () => {
    test("should fetch the correct URL, with POST and the correct headers and payload successfully", async () => {
      const givenMessage = "Hello";
      const expectedRootMessageResponse = generateTestChatResponses();
      const fetchSpy = setupAPIServiceSpy(
        StatusCodes.CREATED,
        expectedRootMessageResponse,
        "application/json;charset=UTF-8",
      );

      const givenSessionId = 1234;
      const service = ChatService.getInstance();
      const actualMessageResponse = await service.sendMessage(givenSessionId, givenMessage);

      expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/conversations/${givenSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: givenMessage }),
        expectedStatusCode: StatusCodes.CREATED,
        serviceName: "ChatService",
        serviceFunction: "sendMessage",
        failureMessage: `Failed to send message with session id ${givenSessionId}`,
        expectedContentType: "application/json",
      });

      expect(actualMessageResponse).toEqual(expectedRootMessageResponse);
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      const givenMessage = "Hello";
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      const givenSessionId = 1234;
      const service = ChatService.getInstance();

      await expect(service.sendMessage(givenSessionId, givenMessage)).rejects.toMatchObject(givenFetchError);
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 201, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, givenResponse) => {
        const givenMessage = "Hello";
        setupAPIServiceSpy(StatusCodes.CREATED, givenResponse, "application/json;charset=UTF-8");

        const givenSessionId = 1234;
        const service = ChatService.getInstance();
        const sendMessagePromise = service.sendMessage(givenSessionId, givenMessage);

        const expectedError = {
          ...new RestAPIError(
            ChatService.name,
            "sendMessage",
            "POST",
            `${givenApiServerUrl}/conversations`,
            StatusCodes.CREATED,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            "",
          ),
          cause: expect.anything(),
        };
        await expect(sendMessagePromise).rejects.toMatchObject(expectedError);
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      },
    );
  });

  describe("ChatService.sendArtificialMessage", () => {
    const givenApiServerUrl = "/path/to/api";
    beforeEach(() => {
      jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
    });
    test("should POST with is_artificial=true and return parsed JSON", async () => {
      const expectedResponse = { messages: [] };
      const fetchSpy = setupAPIServiceSpy(StatusCodes.CREATED, expectedResponse, "application/json;charset=UTF-8");

      const svc = ChatService.getInstance();
      const result = await svc.sendArtificialMessage(123, "hidden msg");

      expectCorrectFetchRequest(
        fetchSpy,
        "/path/to/api/conversations/123/messages",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_input: "hidden msg", is_artificial: true }),
          expectedStatusCode: StatusCodes.CREATED,
          serviceName: "ChatService",
          serviceFunction: "sendArtificialMessage",
          failureMessage: `Failed to send artificial message with session id 123`,
          expectedContentType: "application/json",
        }
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("getChatHistory", () => {
    test("should fetch the correct URL, with GET and the correct headers and payload successfully", async () => {
      const givenTestHistoryResponse = generateTestHistory();
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenTestHistoryResponse, "application/json;charset=UTF-8");
      const givenSessionId = 1234;
      const service = ChatService.getInstance();
      const actualHistoryResponse = await service.getChatHistory(givenSessionId);

      expect(fetchSpy).toHaveBeenCalledWith(`${givenApiServerUrl}/conversations/${givenSessionId}/messages`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.OK,
        serviceName: "ChatService",
        serviceFunction: "getChatHistory",
        failureMessage: `Failed to get chat history for session id ${givenSessionId}`,
        expectedContentType: "application/json",
        retryOnFailedToFetch: true
      });

      expect(actualHistoryResponse).toEqual(givenTestHistoryResponse);
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      const givenSessionId = 1234;
      const service = ChatService.getInstance();

      await expect(service.getChatHistory(givenSessionId)).rejects.toMatchObject(givenFetchError);
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, givenResponse) => {
        setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        const givenSessionId = 1234;
        const service = ChatService.getInstance();
        const sendMessagePromise = service.getChatHistory(givenSessionId);

        const expectedError = {
          ...new RestAPIError(
            ChatService.name,
            "getChatHistory",
            "GET",
            `${givenApiServerUrl}/conversations`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            "",
          ),
          cause: expect.anything(),
        };
        await expect(sendMessagePromise).rejects.toMatchObject(expectedError);
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      },
    );
  });
});
