import { ConversationPhase, CurrentPhase } from "./types";
import i18n from "../../i18n/i18n";
const PHASE_NAME_KEYS: Record<ConversationPhase, string> = {
  [ConversationPhase.INITIALIZING]: "phase_initializing",
  [ConversationPhase.INTRO]: "phase_intro",
  [ConversationPhase.COLLECT_EXPERIENCES]: "phase_collecting",
  [ConversationPhase.DIVE_IN]: "phase_exploring",
  [ConversationPhase.ENDED]: "phase_finished",
  [ConversationPhase.UNKNOWN]: "phase_unknown",
};

/**
 * Get a user-friendly name for the conversation phase
 * @param phase {CurrentPhase} - The conversation phase object.
 * @returns {string} User-friendly, translated name (with progress if applicable)
 */
export function getUserFriendlyConversationPhaseName(phase: CurrentPhase): string {
  const key = PHASE_NAME_KEYS[phase.phase] || PHASE_NAME_KEYS[ConversationPhase.UNKNOWN];
  const baseName = i18n.t(key);

  if (phase.phase === ConversationPhase.COLLECT_EXPERIENCES) {
    return `${baseName}: ${phase.current}/${phase.total} ${i18n.t("work_types")}`;
  }

  if (phase.phase === ConversationPhase.DIVE_IN) {
    return `${baseName}: ${phase.current}/${phase.total} ${i18n.t("experiences")}`;
  }

  return baseName;
}