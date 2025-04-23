export enum ExperimentGroup {
  GROUP_A = "GROUP_A",
  GROUP_B = "GROUP_B",
}

export enum SkillsRankingState {
  INITIAL = "INITIAL",
  SKIPPED = "SKIPPED",
  SELF_EVALUATING = "SELF_EVALUATING",
  EVALUATED = "EVALUATED",
}

export interface SkillsRankingStateResponse {
  session_id: number;
  experiment_group: ExperimentGroup;
  current_state: SkillsRankingState;
  ranking: string;
  self_ranking: string | null;
}
