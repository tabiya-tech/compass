import {
  getUserFriendlyConversationPhaseName,
  USER_FRIENDLY_PHASE_NAMES,
} from "./getUserFriendlyConversationPhaseName";
import { ConversationPhase } from "./types";

describe("getUserFriendlyConversationPhaseName", () => {
  test.each([
    [USER_FRIENDLY_PHASE_NAMES[ConversationPhase.INTRO], ConversationPhase.INTRO],
    [USER_FRIENDLY_PHASE_NAMES[ConversationPhase.COLLECT_EXPERIENCES], ConversationPhase.COLLECT_EXPERIENCES],
    [USER_FRIENDLY_PHASE_NAMES[ConversationPhase.DIVE_IN], ConversationPhase.DIVE_IN],
    [USER_FRIENDLY_PHASE_NAMES[ConversationPhase.ENDED], ConversationPhase.ENDED],
  ])(
    "should return '%s' for phase '%s'",
    (expectedText, givenPhase) => {
      // GIVEN a random phase
      // WHEN getUserFriendlyConversationPhaseName is called
      const actual = getUserFriendlyConversationPhaseName(givenPhase);

      // THEN it should return the correct user-friendly name
      expect(actual).toBe(expectedText);
    })

  test("should return Unknown message if the provided phase is unknown", () => {
    // GIVEN an unknown phase
    const unknownPhase = "NON_EXISTENT_PHASE" as ConversationPhase;

    // WHEN getUserFriendlyConversationPhaseName is called
    const actual = getUserFriendlyConversationPhaseName(unknownPhase);

    // THEN it should return the user-friendly name for the UNKNOWN phase
    expect(actual).toBe(USER_FRIENDLY_PHASE_NAMES[ConversationPhase.UNKNOWN]);
  })
});
