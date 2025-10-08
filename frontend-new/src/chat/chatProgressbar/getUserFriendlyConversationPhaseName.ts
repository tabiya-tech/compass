import { ConversationPhase, CurrentPhase } from "./types";
import { t } from "i18next";

export const USER_FRIENDLY_PHASE_NAMES: Record<ConversationPhase, string> = {
  [ConversationPhase.INITIALIZING]: t("phase_initializing"),
  [ConversationPhase.INTRO]: t("phase_intro"),
  [ConversationPhase.COLLECT_EXPERIENCES]: t("phase_collecting"),
  [ConversationPhase.DIVE_IN]: t("phase_exploring"),
  [ConversationPhase.ENDED]: t("phase_finished"),
  [ConversationPhase.UNKNOWN]: t("phase_unknown"),
};

/**
 * Get a user-friendly name for the conversation phase
 * @param phase {CurrentPhase} - The conversation phase object.
 * @returns {string} User-friendly, translated name (with progress if applicable)
 */
export function getUserFriendlyConversationPhaseName(phase: CurrentPhase): string {
  if (phase.phase === ConversationPhase.COLLECT_EXPERIENCES) {
    return `${USER_FRIENDLY_PHASE_NAMES[ConversationPhase.COLLECT_EXPERIENCES]}: ${phase.current}/${phase.total} ${t("work_types")}`;
  }

  if (phase.phase === ConversationPhase.DIVE_IN) {
    return `${USER_FRIENDLY_PHASE_NAMES[ConversationPhase.DIVE_IN]}: ${phase.current}/${phase.total} ${t("experiences")}`;
  }

  return USER_FRIENDLY_PHASE_NAMES[phase.phase] || USER_FRIENDLY_PHASE_NAMES[ConversationPhase.UNKNOWN];
}