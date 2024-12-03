import { getServiceErrorFactory } from "src/error/ServiceError/ServiceError";
import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import { getBackendUrl } from "src/envService";
import { ConverstaionResponse } from "./ChatService.types";

export default class ChatService {
  readonly chatEndpointUrl: string;
  readonly chatHistoryEndpointUrl: string;
  readonly apiServerUrl: string;
  private readonly sessionId: number;

  constructor(sessionId: number) {
    this.apiServerUrl = getBackendUrl();
    this.chatEndpointUrl = `${this.apiServerUrl}/conversation`;
    this.chatHistoryEndpointUrl = `${this.apiServerUrl}/conversation/history`;
    this.sessionId = sessionId;
  }

  /**
   * Get the singleton instance of the ChatService.
   * @returns {ChatService} The singleton instance of the ChatService.
   * @param sessionId The session ID to use for the chat service.
   */
  static getInstance(sessionId: number): ChatService {
    return new ChatService(sessionId);
  }

  public getSessionId(): number {
    return this.sessionId;
  }

  public async sendMessage(message: string): Promise<ConverstaionResponse> {
    const serviceName = "ChatService";
    const serviceFunction = "sendMessage";
    const method = "POST";
    const ChatURL = this.chatEndpointUrl;
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, ChatURL);

    const response = await customFetch(ChatURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: this.getSessionId(),
        user_input: message,
      }),
      expectedStatusCode: StatusCodes.CREATED,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to send message with session id ${this.getSessionId()}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();

    let messageResponse: ConverstaionResponse;
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

  async clearChat(): Promise<void> {
    const serviceName = "ChatService";
    const serviceFunction = "clearChat";
    const method = "GET";
    const qualifiedURL = `${this.chatEndpointUrl}?user_input=&clear_memory=true&session_id=${this.getSessionId()}`;

    await customFetch(qualifiedURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to clear chat for session id ${this.getSessionId()}`,
      expectedContentType: "application/json",
    });
  }

  public async getChatHistory(): Promise<ConverstaionResponse> {
    const serviceName = "ChatService";
    const serviceFunction = "getChatHistory";
    const method = "GET";
    const qualifiedURL = `${this.chatHistoryEndpointUrl}?session_id=${this.getSessionId()}`;

    const response = await customFetch(qualifiedURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to get chat history for session id ${this.getSessionId()}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();

    let chatHistory: ConverstaionResponse;
    try {
      chatHistory = JSON.parse(responseBody);
    } catch (e: any) {
      const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, qualifiedURL);
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
