import { ConversationPhase } from "./types";

export const USER_FRIENDLY_PHASE_NAMES: Record<ConversationPhase, string> = {
  [ConversationPhase.INTRO]: "Introduction",
  [ConversationPhase.COLLECT_EXPERIENCES]: "Collecting experiences",
  [ConversationPhase.DIVE_IN]: "Exploring skills",
  [ConversationPhase.ENDED]: "Conversation finished",
  [ConversationPhase.UNKNOWN]: "Unknown phase",
}

/**
 * Get a user-friendly name for the conversation phase
 * @param phase {ConversationPhase} - The conversation phase.
 */
export function getUserFriendlyConversationPhaseName(phase: ConversationPhase) {
  return USER_FRIENDLY_PHASE_NAMES[phase] || USER_FRIENDLY_PHASE_NAMES[ConversationPhase.UNKNOWN];
}
