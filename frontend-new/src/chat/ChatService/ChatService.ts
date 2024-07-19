import { getServiceErrorFactory } from "src/error/error";
import { StatusCodes } from "http-status-codes";
import { fetchWithAuth } from "src/apiService/APIService";
import ErrorConstants from "src/error/error.constants";
import { getBackendUrl } from "src/envService";
import { ConverstaionResponse } from "./ChatService.types";

export default class ChatService {
  readonly chatEndpointUrl: string;
  readonly chatHistoryEndpointUrl: string;
  readonly apiServerUrl: string;
  readonly generateNewSessionEndpointUrl: string;
  private readonly sessionId: number;

  constructor(sessionId: number) {
    this.apiServerUrl = getBackendUrl();
    this.chatEndpointUrl = `${this.apiServerUrl}/conversation`;
    this.chatHistoryEndpointUrl = `${this.apiServerUrl}/conversation/history`;
    this.generateNewSessionEndpointUrl = `${this.apiServerUrl}/conversation/new-session`;
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
    const method = "GET";
    const constructedChatURL = `${this.chatEndpointUrl}?user_input=${message}&session_id=${this.getSessionId()}`;
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, constructedChatURL);

    const response = await fetchWithAuth(constructedChatURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
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

    await fetchWithAuth(qualifiedURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to clear chat for session id ${this.getSessionId()}`,
      expectedContentType: "application/json",
    });
  }

  /**
   * Get a new session ID from the chat service.
   */
  async getNewSession(): Promise<number> {
    const serviceName = "ChatService";
    const serviceFunction = "getNewSession";
    const method = "GET";
    const qualifiedURL = `${this.generateNewSessionEndpointUrl}`;

    let response: Response | null = null;

    try {
      response = await fetchWithAuth(qualifiedURL, {
          method: method,
          headers: { "Content-Type": "application/json" },
          expectedStatusCode: StatusCodes.CREATED,
          serviceName,
          serviceFunction,
          failureMessage: `Failed to generate new session`,
          expectedContentType: "application/json",
      });

      const { session_id } = JSON.parse(await response.text());

      return session_id;
    } catch (e) {
      console.log(e)
      const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, qualifiedURL);

      throw errorFactory(
        response?.status!,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          responseBody: response?.text(),
          error: e,
        }
      );
    }
  }

  public async getChatHistory(): Promise<ConverstaionResponse> {
    const serviceName = "ChatService";
    const serviceFunction = "getChatHistory";
    const method = "GET";
    const qualifiedURL = `${this.chatHistoryEndpointUrl}?session_id=${this.getSessionId()}`;

    const response = await fetchWithAuth(qualifiedURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to get chat history for session id ${this.getSessionId()}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();

    let chatHistory: ConverstaionResponse
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
