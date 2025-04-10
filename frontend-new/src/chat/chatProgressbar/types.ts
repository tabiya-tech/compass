export enum ConversationPhase {
  INITIALIZING = "INITIALIZING",
  INTRO = "INTRO",
  COLLECT_EXPERIENCES = "COLLECT_EXPERIENCES",
  DIVE_IN = "DIVE_IN",
  ENDED = "ENDED",
  UNKNOWN = "UNKNOWN"
}

export type CurrentPhase = {
  percentage: number
  phase: ConversationPhase
}

export const defaultCurrentPhase = {
  phase: ConversationPhase.INITIALIZING,
  percentage: 0
}
