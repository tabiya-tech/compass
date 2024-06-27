import { getServiceErrorFactory } from "src/error/error";
import { StatusCodes } from "http-status-codes";
import { fetchWithAuth } from "src/apiService/APIService";
import ErrorConstants from "src/error/error.constants";
import { getBackendUrl } from "src/envService";
import { RootObject } from "./ChatService.types";
import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";

export default class ChatService {
  readonly chatEndpointUrl: string;
  readonly apiServerUrl: string;
  private sessionId: number;

  constructor() {
    this.apiServerUrl = getBackendUrl();
    this.chatEndpointUrl = `${this.apiServerUrl}/conversation`;
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): number {
    const storedSessionId = PersistentStorageService.getChatSessionID();
    if (!storedSessionId) throw new Error("No session id found");
    const sessionId = Number(storedSessionId);
    if (isNaN(sessionId)) throw new Error("Session id found is not a number");
    return sessionId;
  }

  public getSessionId(): number {
    return this.sessionId;
  }

  public async sendMessage(message: string): Promise<RootObject> {
    const serviceName = "ChatService";
    const serviceFunction = "sendMessage";
    const method = "GET";
    const qualifiedURL = `${this.chatEndpointUrl}?user_input=${message}&session_id=${this.getSessionId()}`;
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, qualifiedURL);

    const response = await fetchWithAuth(qualifiedURL, {
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

    let messageResponse: RootObject;
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

  public async clearChat(): Promise<RootObject> {
    const serviceName = "ChatService";
    const serviceFunction = "clearChat";
    const method = "GET";
    const qualifiedURL = `${this.chatEndpointUrl}?user_input=&clear_memory=true&session_id=${this.getSessionId()}`;
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, qualifiedURL);

    const response = await fetchWithAuth(qualifiedURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to clear chat for session id ${this.getSessionId()}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();

    let clearChatResponse: RootObject;
    try {
      clearChatResponse = JSON.parse(responseBody);
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

    return clearChatResponse;
  }
}
