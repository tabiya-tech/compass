export enum ExperimentGroup {
  GROUP_A = "GROUP_A",
  GROUP_B = "GROUP_B",
}

export enum ButtonPositionGroup {
  CONTINUE_BUTTON_FIRST = "CONTINUE_BUTTON_FIRST",
  INFO_BUTTON_FIRST = "INFO_BUTTON_FIRST",
}

export enum SkillsRankingState {
  INITIAL = "INITIAL",
  SKIPPED = "SKIPPED",
  SELF_EVALUATING = "SELF_EVALUATING",
  EVALUATED = "EVALUATED",
}

export type RankValue = "10%" | "20%" | "30%" | "40%" | "50%" | "60%" | "70%" | "80%" | "90%" | "100%";

export interface SkillsRankingStateResponse {
  session_id: number;
  experiment_group: ExperimentGroup;
  current_state: SkillsRankingState;
  ranking: RankValue;
  self_ranking: RankValue | null;
}
