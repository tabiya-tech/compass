import "src/_test_utilities/consoleMock";
import ChatService from "./ChatService";
import { StatusCodes } from "http-status-codes";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import {
  generateTestChatResponses,
  generateTestHistory,
} from "src/chat/ChatService/_test_utilities/generateTestChatResponses";


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

    // THEN expect the service to be constructed successfully
    expect(actualFirstInstance).toBeDefined();

    // AND the service should have the correct endpoint urls
    expect(actualFirstInstance.apiServerUrl).toEqual(givenApiServerUrl);
    expect(actualFirstInstance.chatEndpointUrl).toEqual(`${givenApiServerUrl}/conversations`);

    // AND WHEN the service is constructed again
    const actualSecondInstance = ChatService.getInstance();
    expect(actualFirstInstance).toBe(actualSecondInstance);

    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("sendMessage", () => {
    test("should fetch the correct URL, with POST and the correct headers and payload successfully", async () => {
      // GIVEN some message specification to send
      const givenMessage = "Hello";
      // AND the send message REST API will respond with OK and some message response
      const expectedRootMessageResponse = generateTestChatResponses();
      const fetchSpy = setupAPIServiceSpy(
        StatusCodes.CREATED,
        expectedRootMessageResponse,
        "application/json;charset=UTF-8",
      );

      // WHEN the sendMessage function is called with the given arguments
      const givenSessionId = 1234;
      const service = ChatService.getInstance();
      const actualMessageResponse = await service.sendMessage(givenSessionId, givenMessage);

      // THEN expect it to make a GET request
      // AND the headers
      // AND the request payload to contain the given arguments
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

      // AND returns the message response
      expect(actualMessageResponse).toEqual(expectedRootMessageResponse);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      const givenMessage = "Hello";
      // GIVEN fetch rejects with some unknown error for sending a message on a given session
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN calling sendMessage function
      const givenSessionId = 1234;
      const service = ChatService.getInstance();

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.sendMessage(givenSessionId, givenMessage)).rejects.toMatchObject(givenFetchError);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 201, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, givenResponse) => {
        // GIVEN some message specification to send
        const givenMessage = "Hello";
        // AND the send message REST API will respond with OK and some response that does conform to the messageResponseSchema even if it states that it is application/json
        setupAPIServiceSpy(StatusCodes.CREATED, givenResponse, "application/json;charset=UTF-8");

        // WHEN the sendMessage function is called with the given arguments
        const givenSessionId = 1234;
        const service = ChatService.getInstance();
        const sendMessagePromise = service.sendMessage(givenSessionId, givenMessage);

        // THEN expected it to reject with the error response
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

        // AND expect no errors or warning to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      },
    );
  });

  describe("getChatHistory", () => {
    test("should fetch the correct URL, with GET and the correct headers and payload successfully", async () => {
      // GIVEN some history to return
      const givenTestHistoryResponse = generateTestHistory();
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenTestHistoryResponse, "application/json;charset=UTF-8");
      // WHEN the getChatHistory function is called
      const givenSessionId = 1234;
      const service = ChatService.getInstance();
      const actualHistoryResponse = await service.getChatHistory(givenSessionId);

      // THEN expect it to make a GET request
      // AND the headers
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

      // AND returns the history response
      expect(actualHistoryResponse).toEqual(givenTestHistoryResponse);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error when getting the history of a given session
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN calling getChatHistory function
      const givenSessionId = 1234;
      const service = ChatService.getInstance();

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.getChatHistory(givenSessionId)).rejects.toMatchObject(givenFetchError);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, givenResponse) => {
        // GIVEN some message specification to send
        // AND the send message REST API will respond with OK and some response that does conform to the messageResponseSchema even if it states that it is application/json
        setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN the sendMessage function is called with the given arguments
        const givenSessionId = 1234;
        const service = ChatService.getInstance();
        const sendMessagePromise = service.getChatHistory(givenSessionId);

        // THEN expected it to reject with the error response
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

        // AND expect no errors or warning to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      },
    );
  });
});
