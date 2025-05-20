export enum CompareAgainstGroup {
  AGAINST_OTHER_JOB_SEEKERS = "against_other_job_seekers",
  AGAINST_JOB_MARKET = "against_job_market"
}

export enum ButtonOrderGroup {
  SKIP_BUTTON_FIRST = "skip_button_first",
  VIEW_BUTTON_FIRST = "view_button_first"
}

export interface SkillRankingExperimentGroups {
  compare_against: CompareAgainstGroup;
  button_order: ButtonOrderGroup;
  delayed_results: boolean;
}

export enum SkillsRankingPhase {
  INITIAL = "INITIAL",
  SKIPPED = "SKIPPED",
  CANCELLED = "CANCELLED",
  SELF_EVALUATING = "SELF_EVALUATING",
  EVALUATED = "EVALUATED"
}

export interface SkillsRankingState {
  session_id: number;
  experiment_groups: SkillRankingExperimentGroups;
  phase: SkillsRankingPhase;
  ranking: string | null;
  self_ranking: string | null;
}

export const skillsRankingStateDefault: SkillsRankingState = {
  session_id: -1,
  experiment_groups: {
    compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
    button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
    delayed_results: false,
  },
  phase: SkillsRankingPhase.INITIAL,
  ranking: null,
  self_ranking: null,
}

export interface SkillsRankingResult {
  ranking: string;
}