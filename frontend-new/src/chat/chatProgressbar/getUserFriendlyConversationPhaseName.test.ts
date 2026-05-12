import { getUserFriendlyConversationPhaseName } from "./getUserFriendlyConversationPhaseName";
import { ConversationPhase, CurrentPhase, PreferenceSubPhase } from "./types";
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
    };

    // WHEN getUserFriendlyConversationPhaseName is called
    const actual = getUserFriendlyConversationPhaseName(givenConversationPhase);

    // THEN it should return the user-friendly name for the UNKNOWN phase.
    expect(actual).toBe(i18n.t("chat.chatProgressbar.phases.unknown"));
  });

  /**
   * PREFERENCE_ELICITATION sub-phase rendering.
   *
   * Contract:
   * - BWS sub-phase: total is the fixed 12 occupation-ranking tasks.
   *   Renders as "Comparing careers: X of 12".
   * - Other sub-phases (EXPERIENCE_QUESTIONS, VIGNETTES, FOLLOW_UP, GATE,
   *   WRAPUP): adaptive count, no denominator. Each renders its own
   *   sub-phase-specific label.
   * - Sub-phases must never be confused for each other.
   */
  describe("PREFERENCE_ELICITATION sub-phases", () => {
    test("BWS sub-phase renders 'Comparing careers: X of 12'", () => {
      const givenPhase: CurrentPhase = {
        phase: ConversationPhase.PREFERENCE_ELICITATION,
        percentage: 75,
        current: 3,
        total: 12,
        sub_phase: PreferenceSubPhase.BWS,
      };

      const actual = getUserFriendlyConversationPhaseName(givenPhase);

      expect(actual).toBe(
        `${i18n.t("chat.chatProgressbar.preferenceSubPhases.bws")}: 3 ${i18n.t("chat.chatProgressbar.labels.of")} 12`
      );
    });

    test("BWS sub-phase is NOT mislabelled with old wording", () => {
      const givenPhase: CurrentPhase = {
        phase: ConversationPhase.PREFERENCE_ELICITATION,
        percentage: 75,
        current: 5,
        total: 12,
        sub_phase: PreferenceSubPhase.BWS,
      };

      const actual = getUserFriendlyConversationPhaseName(givenPhase);

      expect(actual).not.toContain(i18n.t("chat.chatProgressbar.phases.discoveringPreferences"));
      expect(actual).not.toContain(i18n.t("chat.chatProgressbar.phases.rankingOccupations"));
      expect(actual).not.toContain(i18n.t("chat.chatProgressbar.labels.tasks"));
      expect(actual).not.toContain(i18n.t("chat.chatProgressbar.labels.questions"));
    });

    test.each([
      [PreferenceSubPhase.EXPERIENCE_QUESTIONS, "chat.chatProgressbar.preferenceSubPhases.experienceQuestions"],
      [PreferenceSubPhase.VIGNETTES, "chat.chatProgressbar.preferenceSubPhases.vignettes"],
      [PreferenceSubPhase.FOLLOW_UP, "chat.chatProgressbar.preferenceSubPhases.followUp"],
      [PreferenceSubPhase.GATE, "chat.chatProgressbar.preferenceSubPhases.gate"],
      [PreferenceSubPhase.WRAPUP, "chat.chatProgressbar.preferenceSubPhases.wrapup"],
    ])(
      "sub-phase %s renders its own label (no X/Y counter)",
      (subPhase, translationKey) => {
        const givenPhase: CurrentPhase = {
          phase: ConversationPhase.PREFERENCE_ELICITATION,
          percentage: 72,
          current: null,
          total: null,
          sub_phase: subPhase,
        };

        const actual = getUserFriendlyConversationPhaseName(givenPhase);

        expect(actual).toBe(i18n.t(translationKey));
        expect(actual).not.toMatch(/\d+\/\d+/);
        expect(actual).not.toMatch(/\d+ of \d+/);
      }
    );

    test("non-BWS sub-phases never render BWS wording", () => {
      const subPhases = [
        PreferenceSubPhase.EXPERIENCE_QUESTIONS,
        PreferenceSubPhase.VIGNETTES,
        PreferenceSubPhase.FOLLOW_UP,
        PreferenceSubPhase.GATE,
        PreferenceSubPhase.WRAPUP,
      ];
      const bwsLabel = i18n.t("chat.chatProgressbar.preferenceSubPhases.bws");
      const ofLabel = i18n.t("chat.chatProgressbar.labels.of");

      for (const sub of subPhases) {
        const result = getUserFriendlyConversationPhaseName({
          phase: ConversationPhase.PREFERENCE_ELICITATION,
          percentage: 72,
          current: null,
          total: null,
          sub_phase: sub,
        });
        expect(result).not.toContain(bwsLabel);
        expect(result).not.toContain(` ${ofLabel} `);
      }
    });

    test("missing sub_phase falls back to the top-level phase name", () => {
      // Defensive: if backend ever omits sub_phase during PREFERENCE_ELICITATION,
      // we should still render a sensible label rather than an empty string.
      const givenPhase: CurrentPhase = {
        phase: ConversationPhase.PREFERENCE_ELICITATION,
        percentage: 72,
        current: null,
        total: null,
        sub_phase: null,
      };

      const actual = getUserFriendlyConversationPhaseName(givenPhase);

      expect(actual).toBe(i18n.t("chat.chatProgressbar.phases.preferenceElicitation"));
    });
  });
});
