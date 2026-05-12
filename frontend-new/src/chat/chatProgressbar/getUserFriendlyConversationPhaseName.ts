import { ConversationPhase, CurrentPhase, PreferenceSubPhase } from "./types";
import i18n from "src/i18n/i18n";

// Use a Proxy to create a getter pattern that fetches translations on-demand.
// This ensures that if the user changes the language, translations are always up-to-date.
const getUserFriendlyPhaseNames = (): Record<ConversationPhase, string> => {
  return new Proxy({} as Record<ConversationPhase, string>, {
    get(target, prop: string | symbol) {
      if (typeof prop !== "string") return undefined;

      const phase = prop as ConversationPhase;
      const translationMap: Record<ConversationPhase, string> = {
        [ConversationPhase.INITIALIZING]: "chat.chatProgressbar.phases.initializing",
        [ConversationPhase.INTRO]: "chat.chatProgressbar.phases.intro",
        [ConversationPhase.COLLECT_EXPERIENCES]: "chat.chatProgressbar.phases.collecting",
        [ConversationPhase.DIVE_IN]: "chat.chatProgressbar.phases.exploring",
        [ConversationPhase.PREFERENCE_ELICITATION]: "chat.chatProgressbar.phases.preferenceElicitation",
        [ConversationPhase.RECOMMENDATION]: "chat.chatProgressbar.phases.recommendations",
        [ConversationPhase.ENDED]: "chat.chatProgressbar.phases.finished",
        [ConversationPhase.UNKNOWN]: "chat.chatProgressbar.phases.unknown",
      };

      return i18n.t(translationMap[phase] || translationMap[ConversationPhase.UNKNOWN]);
    },
  });
};

// Per-sub-phase labels for the preference-elicitation agent. BWS is handled
// separately because it has a deterministic counter (12 tasks).
const PREFERENCE_SUB_PHASE_TRANSLATION_KEYS: Partial<Record<PreferenceSubPhase, string>> = {
  [PreferenceSubPhase.EXPERIENCE_QUESTIONS]: "chat.chatProgressbar.preferenceSubPhases.experienceQuestions",
  [PreferenceSubPhase.VIGNETTES]: "chat.chatProgressbar.preferenceSubPhases.vignettes",
  [PreferenceSubPhase.FOLLOW_UP]: "chat.chatProgressbar.preferenceSubPhases.followUp",
  [PreferenceSubPhase.GATE]: "chat.chatProgressbar.preferenceSubPhases.gate",
  [PreferenceSubPhase.WRAPUP]: "chat.chatProgressbar.preferenceSubPhases.wrapup",
};

function renderPreferenceElicitation(phase: CurrentPhase, fallbackPhaseName: string): string {
  // BWS sub-phase: deterministic 12 occupation-ranking tasks → show counter.
  if (phase.sub_phase === PreferenceSubPhase.BWS && phase.current !== null && phase.total !== null) {
    return `${i18n.t("chat.chatProgressbar.preferenceSubPhases.bws")}: ${phase.current} ${i18n.t("chat.chatProgressbar.labels.of")} ${phase.total}`;
  }

  // Other sub-phases: count is adaptive, no honest denominator. Render the
  // sub-phase-specific label.
  const subPhaseKey = phase.sub_phase
    ? PREFERENCE_SUB_PHASE_TRANSLATION_KEYS[phase.sub_phase as PreferenceSubPhase]
    : undefined;
  if (subPhaseKey) {
    return i18n.t(subPhaseKey);
  }

  // No sub-phase signal (or one we don't recognise) → fall back to the
  // top-level phase name.
  return fallbackPhaseName;
}

/**
 * Get a user-friendly name for the conversation phase
 * @param phase {CurrentPhase} - The conversation phase object.
 * @returns {string} User-friendly, translated name (with progress if applicable)
 */
export function getUserFriendlyConversationPhaseName(phase: CurrentPhase): string {
  const USER_FRIENDLY_PHASE_NAMES = getUserFriendlyPhaseNames();
  if (phase.phase === ConversationPhase.COLLECT_EXPERIENCES) {
    return `${USER_FRIENDLY_PHASE_NAMES[ConversationPhase.COLLECT_EXPERIENCES]}: ${phase.current}/${phase.total} ${i18n.t("chat.chatProgressbar.labels.workTypes")}`;
  }

  if (phase.phase === ConversationPhase.DIVE_IN) {
    return `${USER_FRIENDLY_PHASE_NAMES[ConversationPhase.DIVE_IN]}: ${phase.current}/${phase.total} ${i18n.t("chat.chatProgressbar.labels.experiences")}`;
  }

  if (phase.phase === ConversationPhase.PREFERENCE_ELICITATION) {
    return renderPreferenceElicitation(phase, USER_FRIENDLY_PHASE_NAMES[ConversationPhase.PREFERENCE_ELICITATION]);
  }

  return USER_FRIENDLY_PHASE_NAMES[phase.phase] || USER_FRIENDLY_PHASE_NAMES[ConversationPhase.UNKNOWN];
}
