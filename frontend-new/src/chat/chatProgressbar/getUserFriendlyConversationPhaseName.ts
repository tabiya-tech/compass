import { ConversationPhase, CurrentPhase } from "./types";

export const USER_FRIENDLY_PHASE_NAMES: Record<ConversationPhase, string> = {
  [ConversationPhase.INITIALIZING]: "Initializing...",
  [ConversationPhase.INTRO]: "Introduction",
  [ConversationPhase.COLLECT_EXPERIENCES]: "Collecting",
  [ConversationPhase.DIVE_IN]: "Exploring",
  [ConversationPhase.ENDED]: "Conversation finished",
  [ConversationPhase.UNKNOWN]: "Unknown phase",
};

/**
 * Get a user-friendly name for the conversation phase
 * @param phase {ConversationPhase} - The conversation phase.
 */
export function getUserFriendlyConversationPhaseName(phase: CurrentPhase) {
  if (phase.phase === ConversationPhase.COLLECT_EXPERIENCES){
    return `${USER_FRIENDLY_PHASE_NAMES.COLLECT_EXPERIENCES}: ${phase.current}/${phase.total} work types`;
  }

  if (phase.phase === ConversationPhase.DIVE_IN){
    return `${USER_FRIENDLY_PHASE_NAMES.DIVE_IN}: ${phase.current}/${phase.total} experiences`;
  }

  return USER_FRIENDLY_PHASE_NAMES[phase.phase] || USER_FRIENDLY_PHASE_NAMES[ConversationPhase.UNKNOWN];
}
