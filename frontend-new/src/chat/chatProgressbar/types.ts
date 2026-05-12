export enum ConversationPhase {
  INITIALIZING = "INITIALIZING",
  INTRO = "INTRO",
  COLLECT_EXPERIENCES = "COLLECT_EXPERIENCES",
  DIVE_IN = "DIVE_IN",
  PREFERENCE_ELICITATION = "PREFERENCE_ELICITATION",
  RECOMMENDATION = "RECOMMENDATION",
  ENDED = "ENDED",
  UNKNOWN = "UNKNOWN",
}

// Sub-phase identifiers for PREFERENCE_ELICITATION. Mirror the literal type on
// the backend's PreferenceElicitationAgentState.conversation_phase.
export enum PreferenceSubPhase {
  INTRO = "INTRO",
  EXPERIENCE_QUESTIONS = "EXPERIENCE_QUESTIONS",
  VIGNETTES = "VIGNETTES",
  FOLLOW_UP = "FOLLOW_UP",
  GATE = "GATE",
  BWS = "BWS",
  WRAPUP = "WRAPUP",
  COMPLETE = "COMPLETE",
}

export type CurrentPhase = {
  percentage: number;
  phase: ConversationPhase;
  current: number | null;
  total: number | null;
  sub_phase?: string | null;
};

export const defaultCurrentPhase: CurrentPhase = {
  phase: ConversationPhase.INITIALIZING,
  percentage: 0,
  current: null,
  total: null,
  sub_phase: null,
};
