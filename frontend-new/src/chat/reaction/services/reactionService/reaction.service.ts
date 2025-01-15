import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import { DislikeReaction, DislikeReason, LikeReaction, ReactionKind } from "src/chat/reaction/reaction.types";
import { getBackendUrl } from "src/envService";

interface ReactionRequest {
  kind: ReactionKind;
  reasons?: DislikeReason[];
}

export class ReactionService {
  readonly reactionEndpointUrl: string;
  readonly apiServerUrl: string;

  constructor() {
    this.apiServerUrl = getBackendUrl();
    this.reactionEndpointUrl = `${this.apiServerUrl}/conversations`;
  }

  async sendReaction(sessionId: number, messageId: string, reaction: LikeReaction | DislikeReaction): Promise<void> {
    const serviceName = "ReactionService";
    const serviceFunction = "sendReaction";
    const method = "PUT";

    const reactionURL = `${this.reactionEndpointUrl}/${sessionId}/messages/${messageId}/reactions`;
    
    const body: ReactionRequest = {
      kind: reaction.kind,
      reasons: reaction.reasons,
    };

    await customFetch(reactionURL, {
      method: method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
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
