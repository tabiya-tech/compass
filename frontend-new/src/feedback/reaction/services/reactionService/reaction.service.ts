import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import { Reaction } from "src/feedback/reaction/reaction.types";
import { getBackendUrl } from "src/envService";

export class ReactionService {
  readonly reactionEndpointUrl: string;
  readonly apiServerUrl: string;

  constructor() {
    this.apiServerUrl = getBackendUrl();
    this.reactionEndpointUrl = `${this.apiServerUrl}/conversations`;
  }

  async sendReaction(sessionId: number, messageId: string, reaction: Reaction): Promise<void> {
    const serviceName = "ReactionService";
    const serviceFunction = "sendReaction";
    const method = "PUT";

    const reactionURL = `${this.reactionEndpointUrl}/${sessionId}/messages/${messageId}/reactions`;
    const body = JSON.stringify({ kind: reaction.kind, reason: reaction.reason && [reaction.reason] });

    await customFetch(reactionURL, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: body,
      expectedStatusCode: StatusCodes.CREATED,
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

    const reactionURL = `${this.reactionEndpointUrl}/${sessionId}/messages/${messageId}/reactions`;
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
