export enum ConversationPhase {
  INITIALIZING = "INITIALIZING",
  INTRO = "INTRO",
  COLLECT_EXPERIENCES = "COLLECT_EXPERIENCES",
  DIVE_IN = "DIVE_IN",
  ENDED = "ENDED",
  UNKNOWN = "UNKNOWN",
}

export type CurrentPhase = {
  percentage: number;
  phase: ConversationPhase;
  current: number | null;
  total: number | null;
};

export const defaultCurrentPhase: CurrentPhase = {
  phase: ConversationPhase.INITIALIZING,
  percentage: 0,
  current: null,
  total: null,
};
