import {
  getRandomSkillsRankingState,
  getRandomSkillsRankingPhase,
  getRandomExperimentGroup,
  getRandomScore,
  getRandomSessionID,
} from "./getSkillsRankingState";
import { SkillsRankingPhase, SkillsRankingExperimentGroups, SkillsRankingScore, SkillsRankingState } from "../types";

describe("getSkillsRankingState utilities", () => {
  describe("getRandomSkillsRankingPhase", () => {
    test("should return a valid phase enum member", () => {
      // WHEN calling getRandomSkillsRankingPhase

      const phase = getRandomSkillsRankingPhase();
      // THEN value is in the SkillsRankingPhase
      expect(Object.values(SkillsRankingPhase)).toContain(phase);
    });
  });

  describe("getRandomExperimentGroup", () => {
    test("should return a valid experiment group enum member", () => {
      // WHEN calling getRandomExperimentGroup
      const group = getRandomExperimentGroup();
      // THEN value is in SkillsRankingExperimentGroups
      expect(Object.values(SkillsRankingExperimentGroups)).toContain(group);
    });
  });

  describe("getRandomSessionID", () => {
    test("should return a positive integer within expected range", () => {
      // WHEN calling getRandomSessionID
      const id = getRandomSessionID();
      // THEN value is integer between 1 and 100000000
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(100000000);
    });
  });

  describe("getRandomScore", () => {
    test("should return a score object with required properties and types", () => {
      // WHEN calling getRandomScore
      const score: SkillsRankingScore = getRandomScore();

      // THEN required structure
      expect(Array.isArray(score.above_average_labels)).toBe(true);
      expect(Array.isArray(score.below_average_labels)).toBe(true);
      expect(typeof score.most_demanded_label).toBe("string");
      expect(typeof score.least_demanded_label).toBe("string");
      expect(typeof score.most_demanded_percent).toBe("number");
      expect(typeof score.least_demanded_percent).toBe("number");
      expect(typeof score.average_percent_for_jobseeker_skill_groups).toBe("number");
      expect(typeof score.average_count_for_jobseeker_skill_groups).toBe("number");
      expect(typeof score.province_used).toBe("string");
      expect(typeof score.matched_skill_groups).toBe("number");
      expect(typeof score.calculated_at).toBe("string");
    });
  });

  describe("getRandomSkillsRankingState", () => {
    test("should create a state honoring provided phase and experiment group", () => {
      // GIVEN explicit phase and group
      const givenPhase = SkillsRankingPhase.PERCEIVED_RANK;
      const givenGroup = SkillsRankingExperimentGroups.GROUP_2;

      // WHEN calling getRandomSkillsRankingState
      const state: SkillsRankingState = getRandomSkillsRankingState(givenPhase, givenGroup);

      // THEN mandatory fields present
      expect(state.phase).toHaveLength(1);
      expect(state.phase[0].name).toBe(givenPhase);
      expect(state.metadata.experiment_group).toBe(givenGroup);
      expect(typeof state.session_id).toBe("number");
      expect(state.score).toBeDefined();
      expect(state.metadata.started_at).toBeDefined();
    });

    test("should set completed_at when phase is COMPLETED", () => {
      // GIVEN COMPLETED phase
      const state = getRandomSkillsRankingState(SkillsRankingPhase.COMPLETED);

      // THEN completed_at is defined
      expect(state.phase[0].name).toBe(SkillsRankingPhase.COMPLETED);
      expect(state.metadata.completed_at).toBeDefined();
    });

    test("should create a valid state when no args provided", () => {
      // WHEN calling without parameters
      const state = getRandomSkillsRankingState();

      // THEN phase and experiment group are valid enum members
      expect(Object.values(SkillsRankingPhase)).toContain(state.phase[0].name);
      expect(Object.values(SkillsRankingExperimentGroups)).toContain(state.metadata.experiment_group);
      expect(state.session_id).toBeGreaterThan(0);
    });
  });
});
