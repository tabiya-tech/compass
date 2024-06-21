import { getServiceErrorFactory } from "src/error/error";
import { StatusCodes } from "http-status-codes";
import { fetchWithAuth } from "src/apiService/APIService";
import ErrorConstants from "src/error/error.constants";
import { getBackendUrl } from "src/envService";
import { RootObject, LastMessage } from "./Chat.types";

export type IMessageSpecification = {
  user_id: string;
  message: string;
};

export default class ChatService {
  readonly chatEndpointUrl: string;
  readonly apiServerUrl: string;
  private sessionId: string;

  constructor() {
    this.apiServerUrl = getBackendUrl();
    this.chatEndpointUrl = `${this.apiServerUrl}/conversation`;
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2);
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public async sendMessage(messageSpec: IMessageSpecification): Promise<LastMessage> {
    const serviceName = "ChatService";
    const serviceFunction = "sendMessage";
    const method = "POST";
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, this.chatEndpointUrl);
    const requestBody = JSON.stringify({
      ...messageSpec,
      session_id: this.sessionId,
    });

    const response = await fetchWithAuth(this.chatEndpointUrl, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to send message for user with id ${messageSpec.user_id}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();

    let messageResponse: LastMessage;
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

  public async clearChat(userId: string): Promise<RootObject> {
    const serviceName = "ChatService";
    const serviceFunction = "clearChat";
    const method = "GET";
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, this.chatEndpointUrl);

    const response = await fetchWithAuth(
      `${this.chatEndpointUrl}?user_input=&clear_memory=true&session_id=${this.sessionId}`,
      {
        method: method,
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.OK,
        serviceName,
        serviceFunction,
        failureMessage: `Failed to clear chat for user with id ${userId}`,
        expectedContentType: "application/json",
      }
    );

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
