import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { getBackendUrl } from "src/envService";
import { ConversationResponse } from "./ChatService.types";

export default class ChatService {
  private static instance: ChatService;
  readonly chatEndpointUrl: string;
  readonly chatHistoryEndpointUrl: string;
  readonly apiServerUrl: string;
  private constructor() {
    this.apiServerUrl = getBackendUrl();
    this.chatEndpointUrl = `${this.apiServerUrl}/conversation`;
    this.chatHistoryEndpointUrl = `${this.apiServerUrl}/conversation/history`;
  }

  /**
   * Get the singleton instance of the ChatService.
   * @returns {ChatService} The singleton instance of the ChatService.
   */
  static getInstance(): ChatService {
     if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  public async sendMessage(sessionId: number, message: string): Promise<ConversationResponse> {
    const serviceName = "ChatService";
    const serviceFunction = "sendMessage";
    const method = "POST";
    const ChatURL = this.chatEndpointUrl;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, ChatURL);

    const response = await customFetch(ChatURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_input: message,
      }),
      expectedStatusCode: StatusCodes.CREATED,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to send message with session id ${sessionId}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();

    let messageResponse: ConversationResponse;
    try {
      messageResponse = JSON.parse(responseBody);
    } catch (e: any) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          responseBody,
          error: e,
        }
      );
    }

    return messageResponse;
  }

  public async getChatHistory(sessionId: number): Promise<ConversationResponse> {
    const serviceName = "ChatService";
    const serviceFunction = "getChatHistory";
    const method = "GET";
    const qualifiedURL = `${this.chatHistoryEndpointUrl}?session_id=${sessionId}`;

    const response = await customFetch(qualifiedURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to get chat history for session id ${sessionId}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();

    let chatHistory: ConversationResponse;
    try {
      chatHistory = JSON.parse(responseBody);
    } catch (e: any) {
      const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, qualifiedURL);
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          responseBody,
          error: e,
        }
      );
    }

    return chatHistory;
  }
}
