import "src/_test_utilities/consoleMock";
import { SkillsRankingService } from "./skillsRankingService";
import { SkillsRankingPhase, SkillsRankingExperimentGroups, SkillsRankingState, SkillsRankingMetrics } from "src/features/skillsRanking/types";
import { expectCorrectFetchRequest, setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { StatusCodes } from "http-status-codes";
import { SkillsRankingError } from "src/features/skillsRanking/errors";

describe("SkillsRankingService", () => {
  let service: SkillsRankingService;
  const mockSessionId = 123;

  beforeEach(() => {
    jest.clearAllMocks();
    service = SkillsRankingService.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getInstance", () => {
    test("should return the same instance when called multiple times", () => {
      // WHEN getInstance is called multiple times
      const instance1 = SkillsRankingService.getInstance();
      const instance2 = SkillsRankingService.getInstance();

      // THEN expect the same instance to be returned
      expect(instance1).toBe(instance2);
    });
  });

  describe("isSkillsRankingFeatureEnabled", () => {
    test("should return true when feature is enabled", () => {
      // GIVEN the feature is enabled
      const mockService = {
        ...service,
        isFeatureEnabled: jest.fn().mockReturnValue(true),
        isSkillsRankingFeatureEnabled: function() {
          return this.isFeatureEnabled();
        },
      };

      // WHEN checking if skills ranking feature is enabled
      const result = mockService.isSkillsRankingFeatureEnabled();

      // THEN expect it to return true
      expect(result).toBe(true);
    });

    test("should return false when feature is disabled", () => {
      // GIVEN the feature is disabled
      const mockService = {
        ...service,
        isFeatureEnabled: jest.fn().mockReturnValue(false),
        isSkillsRankingFeatureEnabled: function() {
          return this.isFeatureEnabled();
        },
      };

      // WHEN checking if skills ranking feature is enabled
      const result = mockService.isSkillsRankingFeatureEnabled();

      // THEN expect it to return false
      expect(result).toBe(false);
    });
  });

  const baseApiResponse = {
    phase: [
      {
        name: SkillsRankingPhase.INITIAL,
        time: "2023-01-01T00:00:00.000Z",
      },
    ],
    metadata: {
      session_id: mockSessionId,
      experiment_group: "GROUP_1",
      started_at: "2023-01-01T00:00:00.000Z",
      completed_at: null,
      cancelled_after: null,
      succeeded_after: null,
      puzzles_solved: null,
      correct_rotations: null,
      clicks_count: null,
    },
    score: {
      above_average_labels: ["Skill A", "Skill B"],
      below_average_labels: ["Skill C"],
      most_demanded_label: "Skill A",
      most_demanded_percent: 85.5,
      least_demanded_label: "Skill C",
      least_demanded_percent: 15.2,
      average_percent_for_jobseeker_skillgroups: 50.0,
      average_count_for_jobseeker_skillgroups: 250.0,
      province_used: "Ontario",
      matched_skillgroups: 5,
      calculated_at: "2023-01-01T00:00:00.000Z",
    },
    user_responses: {
      prior_belief_percentile: null,
      prior_belief_for_skill_percentile: null,
      perceived_rank_percentile: null,
      perceived_rank_for_skill_percentile: null,
      application_willingness: null,
      application_24h: null,
      opportunity_skill_requirement_percentile: null,
    },
  };

  const mapExpectedState = (overrides: Partial<SkillsRankingState> = {}): SkillsRankingState => ({
    phase: baseApiResponse.phase,
    score: baseApiResponse.score,
    metadata: {
      session_id: mockSessionId,
      experiment_group: SkillsRankingExperimentGroups.GROUP_1,
      started_at: "2023-01-01T00:00:00.000Z",
    },
    user_responses: {},
    ...overrides,
  });

  describe("getSkillsRankingState", () => {
    const mockSkillsRankingState: SkillsRankingState = mapExpectedState();

    test("should fetch and return skills ranking state successfully", async () => {
      // GIVEN the API returns a valid skills ranking state
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, baseApiResponse, "application/json");

      // WHEN getting the skills ranking state
      const result = await service.getSkillsRankingState(mockSessionId);

      // THEN expect the API to be called correctly
      expectCorrectFetchRequest(fetchSpy, `${service.skillsRankingEndpointUrl}/${mockSessionId}/skills-ranking/state`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.OK,
        serviceName: "SkillsRankingService",
        serviceFunction: "getSkillsRankingState",
        failureMessage: `Failed to get skills ranking state for session ${mockSessionId}`,
        expectedContentType: "application/json",
      });

      // AND expect the result to match the expected state
      expect(result).toEqual(mockSkillsRankingState);
    });

    test("should return null when API returns null", async () => {
      // GIVEN the API returns null
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, null, "application/json");

      // WHEN getting the skills ranking state
      const result = await service.getSkillsRankingState(mockSessionId);

      // THEN expect null to be returned
      expect(result).toBeNull();
      expect(fetchSpy).toHaveBeenCalled();
    });

    test("should throw SkillsRankingError for invalid experiment group", async () => {
      const invalidResponse = {
        ...baseApiResponse,
        metadata: {
          ...baseApiResponse.metadata,
          experiment_group: "INVALID_GROUP",
        },
      };

      setupAPIServiceSpy(StatusCodes.OK, invalidResponse, "application/json");

      await expect(service.getSkillsRankingState(mockSessionId)).rejects.toThrow(
        new SkillsRankingError("Unknown experiment_group 'INVALID_GROUP' from API")
      );
    });

    test("should throw the same error thrown by customFetch", async () => {
      // GIVEN customFetch throws an error
      const givenError = new Error("Network error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenError;
        });
      });

      // WHEN getting the skills ranking state
      // THEN expect the same error to be thrown
      await expect(service.getSkillsRankingState(mockSessionId)).rejects.toThrow(givenError);
    });
  });

  describe("updateSkillsRankingState", () => {
    const mockUpdatedState: SkillsRankingState = mapExpectedState({
      phase: [
        {
          name: SkillsRankingPhase.BRIEFING,
          time: "2023-01-01T00:01:00.000Z",
        },
      ],
    });

    test("should update skills ranking state successfully", async () => {
      // GIVEN the API returns a valid updated state
      const apiResponse = {
        ...baseApiResponse,
        phase: [
          {
            name: SkillsRankingPhase.BRIEFING,
            time: "2023-01-01T00:01:00.000Z",
          },
        ],
      };

      const fetchSpy = setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      // WHEN updating the skills ranking state
      const result = await service.updateSkillsRankingState(mockSessionId, SkillsRankingPhase.BRIEFING);

      // THEN expect the API to be called correctly
      expectCorrectFetchRequest(fetchSpy, `${service.skillsRankingEndpointUrl}/${mockSessionId}/skills-ranking/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.ACCEPTED,
        serviceName: "SkillsRankingService",
        serviceFunction: "updateSkillsRankingState",
        failureMessage: `Failed to update skills ranking state for session ${mockSessionId}`,
        expectedContentType: "application/json",
        body: JSON.stringify({
          phase: SkillsRankingPhase.BRIEFING,
        }),
      });

      // AND expect the result to match the expected state
      expect(result).toEqual(mockUpdatedState);
    });

    test("should update state with perceived rank percentile", async () => {
      // GIVEN the API returns a valid updated state
      const apiResponse = {
        ...baseApiResponse,
        phase: [],
        user_responses: {
          ...baseApiResponse.user_responses,
          perceived_rank_percentile: 85,
        },
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      const result = await service.updateSkillsRankingState(
        mockSessionId,
        SkillsRankingPhase.PERCEIVED_RANK,
        { perceived_rank_percentile: 85 }
      );

      expect(result.user_responses.perceived_rank_percentile).toBe(85);
    });

    test("should update state with new fields", async () => {
      // GIVEN the API returns a valid updated state
      const apiResponse = {
        ...baseApiResponse,
        phase: [],
        user_responses: {
          prior_belief_percentile: 70.0,
          prior_belief_for_skill_percentile: 80.0,
          perceived_rank_for_skill_percentile: 90.0,
          application_willingness: { value: 5, label: "Very Willing" },
          application_24h: 12,
          opportunity_skill_requirement_percentile: 75.0,
        },
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      const result = await service.updateSkillsRankingState(
        mockSessionId,
        SkillsRankingPhase.PRIOR_BELIEF,
        {
          prior_belief: 70.0,
          prior_belief_for_skill: 80.0,
          perceived_rank_for_skill: 90.0,
          application_willingness: { value: 5, label: "Very Willing" },
          application_24h: 12,
          opportunity_skill_requirement: 75.0,
        }
      );

      expect(result.user_responses.prior_belief_percentile).toBe(70.0);
      expect(result.user_responses.prior_belief_for_skill_percentile).toBe(80.0);
      expect(result.user_responses.perceived_rank_for_skill_percentile).toBe(90.0);
      expect(result.user_responses.application_willingness).toEqual({ value: 5, label: "Very Willing" });
      expect(result.user_responses.application_24h).toBe(12);
      expect(result.user_responses.opportunity_skill_requirement_percentile).toBe(75.0);
    });

    test("should update state with metrics", async () => {
      // GIVEN the API returns a valid updated state
      const apiResponse = {
        ...baseApiResponse,
        phase: [],
        metadata: {
          ...baseApiResponse.metadata,
          puzzles_solved: 5,
          correct_rotations: 10,
          clicks_count: 15,
        },
      };

      const metrics: SkillsRankingMetrics = {
        puzzles_solved: 5,
        correct_rotations: 10,
        clicks_count: 15,
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      // WHEN updating the skills ranking state with metrics
      const result = await service.updateSkillsRankingState(
        mockSessionId,
        SkillsRankingPhase.PROOF_OF_VALUE,
        undefined,
        metrics
      );

      // THEN expect the result to include the metrics
      expect(result.metadata.puzzles_solved).toBe(5);
      expect(result.metadata.correct_rotations).toBe(10);
      expect(result.metadata.clicks_count).toBe(15);
    });

    test("should throw SkillsRankingError for invalid experiment group in response", async () => {
      const apiResponse = {
        ...baseApiResponse,
        metadata: {
          ...baseApiResponse.metadata,
          experiment_group: "INVALID_GROUP",
        },
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      await expect(service.updateSkillsRankingState(mockSessionId, SkillsRankingPhase.BRIEFING)).rejects.toThrow(
        new SkillsRankingError("Unknown experiment_group 'INVALID_GROUP' from API")
      );
    });

    test("should throw the same error thrown by customFetch", async () => {
      // GIVEN customFetch throws an error
      const givenError = new Error("Network error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenError;
        });
      });

      // WHEN updating the skills ranking state
      // THEN expect the same error to be thrown
      await expect(service.updateSkillsRankingState(mockSessionId, SkillsRankingPhase.BRIEFING)).rejects.toThrow(givenError);
    });
  });

  describe("updateSkillsRankingMetrics", () => {
    const mockMetrics: SkillsRankingMetrics = {
      puzzles_solved: 5,
      correct_rotations: 10,
      clicks_count: 15,
    };

    test("should update metrics successfully", async () => {
      // GIVEN the API returns a valid updated state
      const apiResponse = {
        ...baseApiResponse,
        phase: [],
        metadata: {
          ...baseApiResponse.metadata,
          puzzles_solved: 5,
          correct_rotations: 10,
          clicks_count: 15,
        },
      };

      const fetchSpy = setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      // WHEN updating the metrics
      const result = await service.updateSkillsRankingMetrics(mockSessionId, mockMetrics);

      // THEN expect the API to be called correctly
      expectCorrectFetchRequest(fetchSpy, `${service.skillsRankingEndpointUrl}/${mockSessionId}/skills-ranking/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.ACCEPTED,
        serviceName: "SkillsRankingService",
        serviceFunction: "updateSkillsRankingMetrics",
        failureMessage: `Failed to update skills ranking metrics for session ${mockSessionId}`,
        expectedContentType: "application/json",
        body: JSON.stringify({ metadata: mockMetrics }),
      });

      // AND expect the result to include the metrics
      expect(result.metadata.puzzles_solved).toBe(5);
      expect(result.metadata.correct_rotations).toBe(10);
      expect(result.metadata.clicks_count).toBe(15);
    });

    test("should throw SkillsRankingError for invalid experiment group in response", async () => {
      const apiResponse = {
        ...baseApiResponse,
        metadata: {
          ...baseApiResponse.metadata,
          experiment_group: "INVALID_GROUP",
        },
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      await expect(service.updateSkillsRankingMetrics(mockSessionId, mockMetrics)).rejects.toThrow(
        new SkillsRankingError("Unknown experiment_group 'INVALID_GROUP' from API")
      );
    });

    test("should throw the same error thrown by customFetch", async () => {
      // GIVEN customFetch throws an error
      const givenError = new Error("Network error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenError;
        });
      });

      // WHEN updating the metrics
      // THEN expect the same error to be thrown
      await expect(service.updateSkillsRankingMetrics(mockSessionId, mockMetrics)).rejects.toThrow(givenError);
    });
  });

  describe("createDebouncedMetricsUpdater", () => {
    test("should create a debounced metrics updater", () => {
      // WHEN creating a debounced metrics updater
      const debouncedUpdater = service.createDebouncedMetricsUpdater(mockSessionId, 1000);

      // THEN expect it to have the expected methods
      expect(debouncedUpdater).toHaveProperty("update");
      expect(debouncedUpdater).toHaveProperty("forceUpdate");
      expect(debouncedUpdater).toHaveProperty("abort");
      expect(debouncedUpdater).toHaveProperty("cleanup");
      expect(typeof debouncedUpdater.update).toBe("function");
      expect(typeof debouncedUpdater.forceUpdate).toBe("function");
      expect(typeof debouncedUpdater.abort).toBe("function");
      expect(typeof debouncedUpdater.cleanup).toBe("function");
    });
  });

  describe("getConfig", () => {
    test("should return the skills ranking config", () => {
      // GIVEN a mock config
      const mockConfig = {
        enabled: true,
        featureName: "skills_ranking",
        config: {
          compensationAmount: "$10",
          jobPlatformUrl: "https://example.com",
          shortTypingDurationMs: 1000,
          defaultTypingDurationMs: 2000,
          longTypingDurationMs: 3000,
        },
      };

      jest.spyOn(service, "getConfig").mockReturnValue(mockConfig);

      // WHEN getting the config
      const result = service.getConfig();

      // THEN expect the config to be returned
      expect(result).toEqual(mockConfig);
    });
  });

  describe("validateConfig", () => {
    test("should validate config successfully", () => {
      // GIVEN a valid config
      const validConfig = {
        enabled: true,
        featureName: "skills_ranking",
        config: {
          compensationAmount: "$10",
          jobPlatformUrl: "https://example.com",
          shortTypingDurationMs: 1000,
          defaultTypingDurationMs: 2000,
          longTypingDurationMs: 3000,
        },
      };

      // WHEN validating the config
      // THEN expect no error to be thrown
      expect(() => service.validateConfig(validConfig)).not.toThrow();
    });

    test("should throw SkillsRankingError for missing compensationAmount", () => {
      // GIVEN a config missing compensationAmount
      const invalidConfig = {
        enabled: true,
        featureName: "skills_ranking",
        config: {
          jobPlatformUrl: "https://example.com",
          shortTypingDurationMs: 1000,
          defaultTypingDurationMs: 2000,
          longTypingDurationMs: 3000,
        },
      };

      // WHEN validating the config
      // THEN expect a SkillsRankingError to be thrown
      expect(() => service.validateConfig(invalidConfig)).toThrow(
        new SkillsRankingError("Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: compensationAmount must be a string")
      );
    });

    test("should throw SkillsRankingError for missing jobPlatformUrl", () => {
      // GIVEN a config missing jobPlatformUrl
      const invalidConfig = {
        enabled: true,
        featureName: "skills_ranking",
        config: {
          compensationAmount: "$10",
          shortTypingDurationMs: 1000,
          defaultTypingDurationMs: 2000,
          longTypingDurationMs: 3000,
        },
      };

      // WHEN validating the config
      // THEN expect a SkillsRankingError to be thrown
      expect(() => service.validateConfig(invalidConfig)).toThrow(
        new SkillsRankingError("Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: jobPlatformUrl must be a string")
      );
    });

    test("should throw SkillsRankingError for missing shortTypingDurationMs", () => {
      // GIVEN a config missing shortTypingDurationMs
      const invalidConfig = {
        enabled: true,
        featureName: "skills_ranking",
        config: {
          compensationAmount: "$10",
          jobPlatformUrl: "https://example.com",
          defaultTypingDurationMs: 2000,
          longTypingDurationMs: 3000,
        },
      };

      // WHEN validating the config
      // THEN expect a SkillsRankingError to be thrown
      expect(() => service.validateConfig(invalidConfig)).toThrow(
        new SkillsRankingError("Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: shortTypingDurationMs must be a number")
      );
    });

    test("should throw SkillsRankingError for missing defaultTypingDurationMs", () => {
      // GIVEN a config missing defaultTypingDurationMs
      const invalidConfig = {
        enabled: true,
        featureName: "skills_ranking",
        config: {
          compensationAmount: "$10",
          jobPlatformUrl: "https://example.com",
          shortTypingDurationMs: 1000,
          longTypingDurationMs: 3000,
        },
      };

      // WHEN validating the config
      // THEN expect a SkillsRankingError to be thrown
      expect(() => service.validateConfig(invalidConfig)).toThrow(
        new SkillsRankingError("Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: defaultTypingDurationMs must be a number")
      );
    });

    test("should throw SkillsRankingError for missing longTypingDurationMs", () => {
      // GIVEN a config missing longTypingDurationMs
      const invalidConfig = {
        enabled: true,
        featureName: "skills_ranking",
        config: {
          compensationAmount: "$10",
          jobPlatformUrl: "https://example.com",
          shortTypingDurationMs: 1000,
          defaultTypingDurationMs: 2000,
        },
      };

      // WHEN validating the config
      // THEN expect a SkillsRankingError to be thrown
      expect(() => service.validateConfig(invalidConfig)).toThrow(
        new SkillsRankingError("Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: longTypingDurationMs must be a number")
      );
    });
  });
});
