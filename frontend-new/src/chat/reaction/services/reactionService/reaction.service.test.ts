import "src/_test_utilities/consoleMock";
import ReactionService from "src/chat/reaction/services/reactionService/reaction.service";
import { DislikeReaction, DislikeReason, LikeReaction, ReactionKind } from "src/chat/reaction/reaction.types";
import { expectCorrectFetchRequest, setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { StatusCodes } from "http-status-codes";

describe("ReactionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  })
  describe("sendReaction", () => {
    test.each([
        ["like reaction", new LikeReaction()],
        ["dislike reaction", new DislikeReaction([DislikeReason.BIASED])]
    ])("should send %s successfully", async (_description, givenReaction) => {
      // GIVEN a reaction on a message with a given messageId in a session with a given SessionId
      const givenSessionId = 123;
      const givenMessageId = "456";

      const fetchSpy = setupAPIServiceSpy(StatusCodes.CREATED, {}, "application/json;charset=UTF-8");

      // WHEN sending a reaction
      const reactionService = new ReactionService();
      await reactionService.sendReaction(givenSessionId, givenMessageId, givenReaction);

      // THEN expect the API to be called correctly
      expectCorrectFetchRequest(fetchSpy, `${reactionService.reactionEndpointUrl}/${givenSessionId}/messages/${givenMessageId}/reactions`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...givenReaction,
          kind: givenReaction.kind,
          reasons: givenReaction.kind === ReactionKind.DISLIKED ? (givenReaction as DislikeReaction).reasons : [],
        }),
        expectedStatusCode: StatusCodes.CREATED,
        serviceName: "ReactionService",
        serviceFunction: "sendReaction",
        failureMessage: `Failed to send reaction for message 456`,
        expectedContentType: "application/json"
      });
      // AND expect no errors or warnings to be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw the same error thrown by the customFetch method", async () => {
      // GIVEN a reaction on a message with a given messageId in a session with a given SessionId
      const givenReaction = new LikeReaction();
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
      // AND expect no errors or warnings to be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
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
      expectCorrectFetchRequest(fetchSpy, `${reactionService.reactionEndpointUrl}/${givenSessionId}/messages/${givenMessageId}/reactions`, {
        method: "DELETE",
        expectedStatusCode: StatusCodes.NO_CONTENT,
        serviceName: "ReactionService",
        serviceFunction: "deleteReaction",
        failureMessage: `Failed to delete reaction for message 456`,
      });
      // AND expect no errors or warnings to be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
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
      // AND expect no errors or warnings to be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
