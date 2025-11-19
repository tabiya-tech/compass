// mute the console
import "src/_test_utilities/consoleMock";

import { SkillsRankingExperimentGroups, SkillsRankingPhase } from "../types";
import { getFlowPathForGroup, skillsRankingGroup1Path, skillsRankingGroup2And3Path } from "./skillsRankingFlowGraph";

describe("skillsRankingFlowGraph", () => {
  test("paths are defined as expected", () => {
    expect(skillsRankingGroup1Path).toEqual([
      SkillsRankingPhase.INITIAL,
      SkillsRankingPhase.BRIEFING,
      SkillsRankingPhase.PROOF_OF_VALUE,
      SkillsRankingPhase.PRIOR_BELIEF,
      SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL,
      SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT,
      SkillsRankingPhase.DISCLOSURE,
      SkillsRankingPhase.COMPLETED,
    ]);
    expect(skillsRankingGroup2And3Path).toEqual([
      SkillsRankingPhase.INITIAL,
      SkillsRankingPhase.BRIEFING,
      SkillsRankingPhase.PROOF_OF_VALUE,
      SkillsRankingPhase.PRIOR_BELIEF,
      SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL,
      SkillsRankingPhase.DISCLOSURE,
      SkillsRankingPhase.APPLICATION_WILLINGNESS,
      SkillsRankingPhase.APPLICATION_24H,
      SkillsRankingPhase.PERCEIVED_RANK,
      SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL,
      SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT,
      SkillsRankingPhase.COMPLETED,
    ]);
  });

  test.each([
    [SkillsRankingExperimentGroups.GROUP_1, skillsRankingGroup1Path],
    [SkillsRankingExperimentGroups.GROUP_2, skillsRankingGroup2And3Path],
    [SkillsRankingExperimentGroups.GROUP_3, skillsRankingGroup2And3Path],
  ])("getFlowPathForGroup(%s) returns expected path", (group, expected) => {
    expect(getFlowPathForGroup(group)).toBe(expected);
  });
});


