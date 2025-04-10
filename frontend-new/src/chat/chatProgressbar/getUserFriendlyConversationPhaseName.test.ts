import {
  getUserFriendlyConversationPhaseName,
  USER_FRIENDLY_PHASE_NAMES,
} from "./getUserFriendlyConversationPhaseName";
import { ConversationPhase, CurrentPhase } from "./types";

describe("getUserFriendlyConversationPhaseName", () => {
  test.each([
    [
      USER_FRIENDLY_PHASE_NAMES.INITIALIZING,
      {
        phase: ConversationPhase.INITIALIZING,
        percentage: 0,
        current: null,
        total: null,
      },
    ],
    [
      USER_FRIENDLY_PHASE_NAMES.INTRO,
      {
        phase: ConversationPhase.INTRO,
        percentage: 0,
        current: null,
        total: null,
      },
    ],
    [
      `${USER_FRIENDLY_PHASE_NAMES.COLLECT_EXPERIENCES}: 1/4 work types`,
      {
        phase: ConversationPhase.COLLECT_EXPERIENCES,
        percentage: 0,
        current: 1,
        total: 4,
      },
    ],
    [
      `${USER_FRIENDLY_PHASE_NAMES.DIVE_IN}: 1/4 experiences`,
      {
        phase: ConversationPhase.DIVE_IN,
        percentage: 0,
        current: 1,
        total: 4,
      },
    ],
    [
      USER_FRIENDLY_PHASE_NAMES.ENDED,
      {
        phase: ConversationPhase.ENDED,
        percentage: 0,
        current: null,
        total: null,
      },
    ],
  ])("should return the expected message'%s'", (expectedText: string, givenPhase: CurrentPhase) => {
    // GIVEN a random conversation phase
    // WHEN getUserFriendlyConversationPhaseName is called
    const actual = getUserFriendlyConversationPhaseName(givenPhase);

    // THEN it should return the correct user-friendly name
    expect(actual).toBe(expectedText);
  });

  test("should return Unknown message if the provided phase is unknown", () => {
    // GIVEN an unknown phase
    const givenConversationPhase = {
      phase: "UNKNOWN" as ConversationPhase,
      percentage: 0,
      current: null,
      total: null,
    }

    // WHEN getUserFriendlyConversationPhaseName is called
    const actual = getUserFriendlyConversationPhaseName(givenConversationPhase);

    // THEN it should return the user-friendly name for the UNKNOWN phase.
    expect(actual).toBe(USER_FRIENDLY_PHASE_NAMES[ConversationPhase.UNKNOWN]);
  })
});
