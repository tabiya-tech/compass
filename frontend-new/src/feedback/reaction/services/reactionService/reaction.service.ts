import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import { Reaction } from "src/feedback/reaction/reaction.types";
import { getBackendUrl } from "src/envService";

export class ReactionService {
  readonly reactionEndpointUrl: string;
  readonly apiServerUrl: string;

  constructor() {
    this.apiServerUrl = getBackendUrl();
    this.reactionEndpointUrl = `${this.apiServerUrl}/conversation`;
  }

  async sendReaction(sessionId: number, messageId: string, reaction: Reaction): Promise<void> {
    const serviceName = "ReactionService";
    const serviceFunction = "sendReaction";
    const method = "PUT";

    const reactionURL = `${this.reactionEndpointUrl}/${sessionId}/messages/${messageId}/reaction`;
    const body = JSON.stringify({ reaction });

    await customFetch(reactionURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: body,
      expectedStatusCode: StatusCodes.OK,
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to send reaction for message ${messageId}`,
      expectedContentType: "application/json",
    });
  }

  async deleteReaction(sessionId: number, messageId: string): Promise<void> {
    const serviceName = "ReactionService";
    const serviceFunction = "deleteReaction";
    const method = "DELETE";

    const reactionURL = `${this.reactionEndpointUrl}/${sessionId}/messages/${messageId}/reaction`;
    await customFetch(reactionURL, {
      method: method,
      expectedStatusCode: StatusCodes.NO_CONTENT,
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to delete reaction for message ${messageId}`,
    });
  }
}

export default ReactionService;
