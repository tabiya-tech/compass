import ReactionService from "src/feedback/reaction/services/reactionService/reaction.service";
import { ReactionType } from "src/feedback/reaction/reaction.types";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { StatusCodes } from "http-status-codes";

describe("ReactionService", () => {
  describe("sendReaction", () => {
    test("should send reaction successfully", async () => {
      // GIVEN a reaction on a message with a given messageId in a session with a given SessionId
      const givenReaction = { kind: ReactionType.LIKED, reason: null };
      const givenSessionId = 123;
      const givenMessageId = "456";

      // AND the API will return a successful response
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, {}, "application/json;charset=UTF-8");

      // WHEN sending a reaction
      const reactionService = new ReactionService();
      await reactionService.sendReaction(givenSessionId, givenMessageId, givenReaction);

      // THEN expect the API to be called correctly
      expect(fetchSpy).toHaveBeenCalledWith(
        `${reactionService.reactionEndpointUrl}/${givenSessionId}/messages/${givenMessageId}/reactions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(givenReaction),
          expectedStatusCode: StatusCodes.CREATED,
          serviceName: "ReactionService",
          serviceFunction: "sendReaction",
          failureMessage: `Failed to send reaction for message 456`,
          expectedContentType: "application/json",
        }
      );
    });

    test("should throw the same error thrown by the customFetch method", async () => {
      // GIVEN a reaction on a message with a given messageId in a session with a given SessionId
      const givenReaction = { kind: ReactionType.LIKED, reason: null };
      const givenSessionId = 123;
      const givenMessageId = "456";

      // AND the API will return an error response
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN sending a reaction
      const reactionService = new ReactionService();

      // THEN expect the correct error to be thrown
      await expect(reactionService.sendReaction(givenSessionId, givenMessageId, givenReaction)).rejects.toThrow(
        givenFetchError
      );
    });
  });

  describe("deleteReaction", () => {
    test("should delete reaction successfully", async () => {
      // GIVEN a message with a given messageId
      const givenSessionId = 123;
      // AND a session with a given SessionId
      const givenMessageId = "456";

      // AND the API will return a successful response
      const fetchSpy = setupAPIServiceSpy(StatusCodes.NO_CONTENT, undefined, "");

      // WHEN deleting the given reaction
      const reactionService = new ReactionService();
      await reactionService.deleteReaction(givenSessionId, givenMessageId);

      // THEN expect the correct API call to be made
      expect(fetchSpy).toHaveBeenCalled();
      // AND expect the response to match the expected response
      expect(fetchSpy).toHaveBeenCalledWith(
        `${reactionService.reactionEndpointUrl}/${givenSessionId}/messages/${givenMessageId}/reactions`,
        {
          method: "DELETE",
          expectedStatusCode: StatusCodes.NO_CONTENT,
          serviceName: "ReactionService",
          serviceFunction: "deleteReaction",
          failureMessage: `Failed to delete reaction for message 456`,
        }
      );
    });

    test("should throw the same error thrown by the customFetch method", async () => {
      // GIVEN a message with a given messageId
      const givenSessionId = 123;
      // AND a session with a given SessionId
      const givenMessageId = "456";

      // AND the API will return an error response
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN deleting the given reaction
      const reactionService = new ReactionService();

      // THEN expect the correct error to be thrown
      await expect(reactionService.deleteReaction(givenSessionId, givenMessageId)).rejects.toThrow(givenFetchError);
    });
  });
});
