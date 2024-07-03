import "src/_test_utilities/consoleMock";
import ChatService from "./ChatService";
import { StatusCodes } from "http-status-codes";
import { ServiceError } from "src/error/error";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import ErrorConstants from "src/error/error.constants";
import {
  generateTestChatResponses,
  generateTestHistory,
} from "src/chat/ChatService/_test_utilities/generateTestChatResponses";
import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";

jest.mock("src/persistentStorageService/PersistentStorageService", () => {
  return {
    __esModule: true,
    PersistentStorageService: {
      getChatSessionID: jest.fn().mockReturnValue("1234"),
    },
  };
});

describe("ChatService", () => {
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should construct the service successfully", () => {
    // GIVEN the service is constructed
    const service = new ChatService();

    // THEN expect the service to be constructed successfully
    expect(service).toBeDefined();

    // AND the service should have the correct endpoint url
    expect(service.chatEndpointUrl).toEqual(`${givenApiServerUrl}/conversation`);
  });

  test("should throw if a sessionId could not be found", () => {
    // GIVEN the service is constructed without a sessionId
    jest.spyOn(PersistentStorageService, "getChatSessionID").mockReturnValueOnce(null);

    // WHEN the service is constructed
    // THEN expect it to throw
    expect(() => new ChatService()).toThrow();
  });

  test("should throw if the sessionId found was not valid", () => {
    // GIVEN the service is constructed with an invalid sessionId
    jest.spyOn(PersistentStorageService, "getChatSessionID").mockReturnValueOnce("invalid");

    // WHEN the service is constructed
    // THEN expect it to throw
    expect(() => new ChatService()).toThrow();
  });

  describe("sendMessage", () => {
    test("should fetch the correct URL, with GET and the correct headers and payload successfully", async () => {
      // GIVEN some message specification to send
      const givenMessage = "Hello";
      // AND the send message REST API will respond with OK and some message response
      const expectedRootMessageResponse = generateTestChatResponses();
      const fetchSpy = setupAPIServiceSpy(
        StatusCodes.OK,
        expectedRootMessageResponse,
        "application/json;charset=UTF-8"
      );

      // WHEN the sendMessage function is called with the given arguments
      const service = new ChatService();
      const actualMessageResponse = await service.sendMessage(givenMessage);

      // THEN expect it to make a GET request
      // AND the headers
      // AND the request payload to contain the given arguments
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/conversation?user_input=${givenMessage}&session_id=${service.getSessionId()}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          expectedStatusCode: StatusCodes.OK,
          serviceName: "ChatService",
          serviceFunction: "sendMessage",
          failureMessage: `Failed to send message with session id ${service.getSessionId()}`,
          expectedContentType: "application/json",
        }
      );

      // AND returns the message response
      expect(actualMessageResponse).toEqual(expectedRootMessageResponse);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      const givenMessage = "Hello";
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/apiService/APIService"), "fetchWithAuth").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN calling sendMessage function
      const service = new ChatService();

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.sendMessage(givenMessage)).rejects.toMatchObject(givenFetchError);
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (description, givenResponse) => {
        // GIVEN some message specification to send
        const givenMessage = "Hello";
        // AND the send message REST API will respond with OK and some response that does conform to the messageResponseSchema even if it states that it is application/json
        setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN the sendMessage function is called with the given arguments
        const service = new ChatService();
        const sendMessagePromise = service.sendMessage(givenMessage);

        // THEN expected it to reject with the error response
        const expectedError = {
          ...new ServiceError(
            ChatService.name,
            "sendMessage",
            "GET",
            `${givenApiServerUrl}/conversation?user_input=${givenMessage}&session_id=${service.getSessionId()}`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
        };
        await expect(sendMessagePromise).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("getChatHistory", () => {
    test("should fetch the correct URL, with GET and the correct headers and payload successfully", async () => {
      // GIVEN some history to return
      const givenTestHistoryResponse = generateTestHistory();
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenTestHistoryResponse, "application/json;charset=UTF-8");

      // WHEN the getChatHistory function is called
      const service = new ChatService();
      const actualHistoryResponse = await service.getChatHistory();

      // THEN expect it to make a GET request
      // AND the headers
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/conversation/history?session_id=${service.getSessionId()}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          expectedStatusCode: StatusCodes.OK,
          serviceName: "ChatService",
          serviceFunction: "getChatHistory",
          failureMessage: `Failed to get chat history for session id ${service.getSessionId()}`,
          expectedContentType: "application/json",
        }
      );

      // AND returns the history response
      expect(actualHistoryResponse).toEqual(givenTestHistoryResponse);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/apiService/APIService"), "fetchWithAuth").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN calling getChatHistory function
      const service = new ChatService();

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.getChatHistory()).rejects.toMatchObject(givenFetchError);
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (description, givenResponse) => {
        // GIVEN some message specification to send
        // AND the send message REST API will respond with OK and some response that does conform to the messageResponseSchema even if it states that it is application/json
        setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN the sendMessage function is called with the given arguments
        const service = new ChatService();
        const sendMessagePromise = service.getChatHistory();

        // THEN expected it to reject with the error response
        const expectedError = {
          ...new ServiceError(
            ChatService.name,
            "getChatHistory",
            "GET",
            `${givenApiServerUrl}/conversation/history?session_id=${service.getSessionId()}`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
        };
        await expect(sendMessagePromise).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("clearChat", () => {
    test("should fetch the correct URL, with GET and the correct headers and payload successfully", async () => {
      // GIVEN a user ID to clear the chat for
      const fetchSpy = setupAPIServiceSpy(
        StatusCodes.OK,
        "cleared chat successfully",
        "application/json;charset=UTF-8"
      );

      // WHEN the clearChat function is called
      const service = new ChatService();
      await service.clearChat();

      // THEN expect it to make a GET request
      // AND the headers
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/conversation?user_input=&clear_memory=true&session_id=${service.getSessionId()}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          expectedStatusCode: StatusCodes.OK,
          serviceName: "ChatService",
          serviceFunction: "clearChat",
          failureMessage: `Failed to clear chat for session id ${service.getSessionId()}`,
          expectedContentType: "application/json",
        }
      );
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/apiService/APIService"), "fetchWithAuth").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN calling clearChat function
      const service = new ChatService();

      // THEN expected it to reject with the same error thrown by fetchWithAuth
      await expect(service.clearChat()).rejects.toMatchObject(givenFetchError);
    });
  });
});
