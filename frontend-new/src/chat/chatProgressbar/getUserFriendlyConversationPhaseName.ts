import { ConversationPhase, CurrentPhase } from "./types";
import i18n from "src/i18n/i18n";
// Compute translations at call time so they react to language changes and avoid module-scope resolution.
export const getUserFriendlyPhaseNames = (): Record<ConversationPhase, string> => ({
  [ConversationPhase.INITIALIZING]: i18n.t("phase_initializing"),
  [ConversationPhase.INTRO]: i18n.t("phase_intro"),
  [ConversationPhase.COLLECT_EXPERIENCES]: i18n.t("phase_collecting"),
  [ConversationPhase.DIVE_IN]: i18n.t("phase_exploring"),
  [ConversationPhase.ENDED]: i18n.t("phase_finished"),
  [ConversationPhase.UNKNOWN]: i18n.t("phase_unknown"),
});

/**
 * Get a user-friendly name for the conversation phase
 * @param phase {CurrentPhase} - The conversation phase object.
 * @returns {string} User-friendly, translated name (with progress if applicable)
 */
export function getUserFriendlyConversationPhaseName(phase: CurrentPhase): string {
  const USER_FRIENDLY_PHASE_NAMES = getUserFriendlyPhaseNames();
  if (phase.phase === ConversationPhase.COLLECT_EXPERIENCES) {
    return `${USER_FRIENDLY_PHASE_NAMES[ConversationPhase.COLLECT_EXPERIENCES]}: ${phase.current}/${phase.total} ${i18n.t("work_types")}`;
  }

  if (phase.phase === ConversationPhase.DIVE_IN) {
    return `${USER_FRIENDLY_PHASE_NAMES[ConversationPhase.DIVE_IN]}: ${phase.current}/${phase.total} ${i18n.t("experiences")}`;
  }

  return USER_FRIENDLY_PHASE_NAMES[phase.phase] || USER_FRIENDLY_PHASE_NAMES[ConversationPhase.UNKNOWN];
}