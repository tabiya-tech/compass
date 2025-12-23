import "src/_test_utilities/consoleMock";
import { SkillsRankingService } from "./skillsRankingService";
import {
  SkillsRankingPhase,
  SkillsRankingExperimentGroups,
  SkillsRankingState,
  SkillsRankingMetrics,
} from "src/features/skillsRanking/types";
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
        isSkillsRankingFeatureEnabled: function () {
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
        isSkillsRankingFeatureEnabled: function () {
          return this.isFeatureEnabled();
        },
      };

      // WHEN checking if skills ranking feature is enabled
      const result = mockService.isSkillsRankingFeatureEnabled();

      // THEN expect it to return false
      expect(result).toBe(false);
    });
  });

  describe("getSkillsRankingState", () => {
    const mockSkillsRankingState: SkillsRankingState = {
      session_id: mockSessionId,
      experiment_group: SkillsRankingExperimentGroups.GROUP_1,
      phases: [
        {
          name: SkillsRankingPhase.INITIAL,
          time: "2023-01-01T00:00:00.000Z",
        },
      ],
      score: {
        jobs_matching_rank: 75,
        comparison_rank: 3,
        comparison_label: "HIGHEST",
        calculated_at: "2023-01-01T00:00:00.000Z",
      },
      started_at: "2023-01-01T00:00:00.000Z",
    };

    test("should fetch and return skills ranking state successfully", async () => {
      // GIVEN the API returns a valid skills ranking state
      const apiResponse = {
        session_id: mockSessionId,
        experiment_group: "GROUP_1",
        phase: [
          {
            name: "INITIAL",
            time: "2023-01-01T00:00:00.000Z",
          },
        ],
        score: {
          jobs_matching_rank: 75,
          comparison_rank: 3,
          comparison_label: "HIGHEST",
          calculated_at: "2023-01-01T00:00:00.000Z",
        },
        started_at: "2023-01-01T00:00:00.000Z",
      };

      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, apiResponse, "application/json");

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
      // GIVEN the API returns an invalid experiment group
      const apiResponse = {
        session_id: mockSessionId,
        experiment_group: "INVALID_GROUP",
        phase: [],
        started_at: "2023-01-01T00:00:00.000Z",
      };

      setupAPIServiceSpy(StatusCodes.OK, apiResponse, "application/json");

      // WHEN getting the skills ranking state
      // THEN expect a SkillsRankingError to be thrown
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
    const mockUpdatedState: SkillsRankingState = {
      session_id: mockSessionId,
      experiment_group: SkillsRankingExperimentGroups.GROUP_1,
      phases: [
        {
          name: SkillsRankingPhase.BRIEFING,
          time: "2023-01-01T00:01:00.000Z",
        },
      ],
      score: {
        jobs_matching_rank: 75,
        comparison_rank: 3,
        comparison_label: "HIGHEST",
        calculated_at: "2023-01-01T00:00:00.000Z",
      },
      started_at: "2023-01-01T00:00:00.000Z",
    };

    test("should update skills ranking state successfully", async () => {
      // GIVEN the API returns a valid updated state
      const apiResponse = {
        session_id: mockSessionId,
        experiment_group: "GROUP_1",
        phase: [
          {
            name: "BRIEFING",
            time: "2023-01-01T00:01:00.000Z",
          },
        ],
        score: {
          jobs_matching_rank: 75,
          comparison_rank: 3,
          comparison_label: "HIGHEST",
          calculated_at: "2023-01-01T00:00:00.000Z",
        },
        started_at: "2023-01-01T00:00:00.000Z",
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
        session_id: mockSessionId,
        experiment_group: "GROUP_1",
        phase: [],
        perceived_rank_percentile: 85,
        started_at: "2023-01-01T00:00:00.000Z",
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      // WHEN updating the skills ranking state with perceived rank percentile
      const result = await service.updateSkillsRankingState(mockSessionId, SkillsRankingPhase.PERCEIVED_RANK, 85);

      // THEN expect the result to include the perceived rank percentile
      expect(result.perceived_rank_percentile).toBe(85);
    });

    test("should update state with retyped rank percentile", async () => {
      // GIVEN the API returns a valid updated state
      const apiResponse = {
        session_id: mockSessionId,
        experiment_group: "GROUP_1",
        phase: [],
        retyped_rank_percentile: 90,
        started_at: "2023-01-01T00:00:00.000Z",
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      // WHEN updating the skills ranking state with retyped rank percentile
      const result = await service.updateSkillsRankingState(
        mockSessionId,
        SkillsRankingPhase.RETYPED_RANK,
        undefined,
        90
      );

      // THEN expect the result to include the retyped rank percentile
      expect(result.retyped_rank_percentile).toBe(90);
    });

    test("should update state with metrics", async () => {
      // GIVEN the API returns a valid updated state
      const apiResponse = {
        session_id: mockSessionId,
        experiment_group: "GROUP_1",
        phase: [],
        puzzles_solved: 5,
        correct_rotations: 10,
        clicks_count: 15,
        started_at: "2023-01-01T00:00:00.000Z",
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
        undefined,
        metrics
      );

      // THEN expect the result to include the metrics
      expect(result.puzzles_solved).toBe(5);
      expect(result.correct_rotations).toBe(10);
      expect(result.clicks_count).toBe(15);
    });

    test("should throw SkillsRankingError for invalid experiment group in response", async () => {
      // GIVEN the API returns an invalid experiment group
      const apiResponse = {
        session_id: mockSessionId,
        experiment_group: "INVALID_GROUP",
        phase: [],
        started_at: "2023-01-01T00:00:00.000Z",
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      // WHEN updating the skills ranking state
      // THEN expect a SkillsRankingError to be thrown
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
      await expect(service.updateSkillsRankingState(mockSessionId, SkillsRankingPhase.BRIEFING)).rejects.toThrow(
        givenError
      );
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
        session_id: mockSessionId,
        experiment_group: "GROUP_1",
        phase: [],
        puzzles_solved: 5,
        correct_rotations: 10,
        clicks_count: 15,
        started_at: "2023-01-01T00:00:00.000Z",
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
        body: JSON.stringify(mockMetrics),
      });

      // AND expect the result to include the metrics
      expect(result.puzzles_solved).toBe(5);
      expect(result.correct_rotations).toBe(10);
      expect(result.clicks_count).toBe(15);
    });

    test("should throw SkillsRankingError for invalid experiment group in response", async () => {
      // GIVEN the API returns an invalid experiment group
      const apiResponse = {
        session_id: mockSessionId,
        experiment_group: "INVALID_GROUP",
        phase: [],
        started_at: "2023-01-01T00:00:00.000Z",
      };

      setupAPIServiceSpy(StatusCodes.ACCEPTED, apiResponse, "application/json");

      // WHEN updating the metrics
      // THEN expect a SkillsRankingError to be thrown
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
        new SkillsRankingError(
          "Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: compensationAmount must be a string"
        )
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
        new SkillsRankingError(
          "Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: jobPlatformUrl must be a string"
        )
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
        new SkillsRankingError(
          "Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: shortTypingDurationMs must be a number"
        )
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
        new SkillsRankingError(
          "Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: defaultTypingDurationMs must be a number"
        )
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
        new SkillsRankingError(
          "Invalid configuration for feature 4b0c7428-9c01-4688-81fd-d3ef159bce79: longTypingDurationMs must be a number"
        )
      );
    });
  });
});
