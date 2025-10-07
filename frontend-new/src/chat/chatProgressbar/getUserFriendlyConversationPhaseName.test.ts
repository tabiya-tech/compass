import { getUserFriendlyConversationPhaseName } from "./getUserFriendlyConversationPhaseName";
import { ConversationPhase, CurrentPhase } from "./types";
import i18n from "../../i18n/i18n";

describe("getUserFriendlyConversationPhaseName", () => {
  test.each([
    [
      i18n.t("chat.chatProgressbar.phases.initializing"),
      {
        phase: ConversationPhase.INITIALIZING,
        percentage: 0,
        current: null,
        total: null,
      },
    ],
    [
      i18n.t("chat.chatProgressbar.phases.intro"),
      {
        phase: ConversationPhase.INTRO,
        percentage: 0,
        current: null,
        total: null,
      },
    ],
    [
      `${i18n.t("chat.chatProgressbar.phases.collecting")}: 1/4 ${i18n.t("chat.chatProgressbar.labels.workTypes")}`,
      {
        phase: ConversationPhase.COLLECT_EXPERIENCES,
        percentage: 0,
        current: 1,
        total: 4,
      },
    ],
    [
      `${i18n.t("chat.chatProgressbar.phases.exploring")}: 1/4 ${i18n.t("chat.chatProgressbar.labels.experiences")}`,
      {
        phase: ConversationPhase.DIVE_IN,
        percentage: 0,
        current: 1,
        total: 4,
      },
    ],
    [
      i18n.t("chat.chatProgressbar.phases.finished"),
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
    expect(actual).toBe(i18n.t("chat.chatProgressbar.phases.unknown"));
  })
});
