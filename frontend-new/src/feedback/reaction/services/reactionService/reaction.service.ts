import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import { Reaction } from "src/feedback/reaction/reaction.types";

export class ReactionService {
  async sendReaction(sessionId:string, messageId: string, reaction: Reaction): Promise<void> {
    const serviceName = "ReactionService";
    const serviceFunction = "sendReaction";
    const method = "PUT";

    const reactionURL = `/conversation/${sessionId}/messages/${messageId}/reaction`;
    await customFetch(
      reactionURL,
      {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: undefined, // implement body along with the API
        expectedStatusCode: StatusCodes.OK,
        serviceName: serviceName,
        serviceFunction: serviceFunction,
        failureMessage: `Failed to send reaction for message ${messageId}`,
        expectedContentType: "application/json",
      }
    );
  }
  async deleteReaction(sessionId:string, messageId: string): Promise<void> {
    const serviceName = "ReactionService";
    const serviceFunction = "deleteReaction";
    const method = "DELETE";

    const reactionURL = `/conversation/${sessionId}/messages/${messageId}/reaction`;
    await customFetch(
      reactionURL,
      {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: undefined, // implement body along with the API
        expectedStatusCode: StatusCodes.NO_CONTENT,
        serviceName: serviceName,
        serviceFunction: serviceFunction,
        failureMessage: `Failed to delete reaction for message ${messageId}`,
        expectedContentType: "application/json",
      }
    );
  }
}

export default ReactionService;