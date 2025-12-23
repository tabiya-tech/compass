// mute the console
import "src/_test_utilities/consoleMock";

import { SkillsRankingExperimentGroups, SkillsRankingPhase } from "../types";
import {
  getFlowPathForGroup,
  skillsRankingHappyPathFull,
  skillsRankingHappyPathSkipped,
} from "./skillsRankingFlowGraph";

describe("skillsRankingFlowGraph", () => {
  test("paths are defined as expected", () => {
    expect(skillsRankingHappyPathFull).toEqual([
      SkillsRankingPhase.INITIAL,
      SkillsRankingPhase.BRIEFING,
      SkillsRankingPhase.PROOF_OF_VALUE,
      SkillsRankingPhase.MARKET_DISCLOSURE,
      SkillsRankingPhase.JOB_SEEKER_DISCLOSURE,
      SkillsRankingPhase.PERCEIVED_RANK,
      SkillsRankingPhase.RETYPED_RANK,
      SkillsRankingPhase.COMPLETED,
    ]);
    expect(skillsRankingHappyPathSkipped).toEqual([
      SkillsRankingPhase.INITIAL,
      SkillsRankingPhase.BRIEFING,
      SkillsRankingPhase.PROOF_OF_VALUE,
      SkillsRankingPhase.JOB_SEEKER_DISCLOSURE,
      SkillsRankingPhase.PERCEIVED_RANK,
      SkillsRankingPhase.COMPLETED,
    ]);
  });

  test.each([
    [SkillsRankingExperimentGroups.GROUP_1, skillsRankingHappyPathFull],
    [SkillsRankingExperimentGroups.GROUP_3, skillsRankingHappyPathFull],
    [SkillsRankingExperimentGroups.GROUP_2, skillsRankingHappyPathSkipped],
    [SkillsRankingExperimentGroups.GROUP_4, skillsRankingHappyPathSkipped],
  ])("getFlowPathForGroup(%s) returns expected path", (group, expected) => {
    expect(getFlowPathForGroup(group)).toBe(expected);
  });
});
