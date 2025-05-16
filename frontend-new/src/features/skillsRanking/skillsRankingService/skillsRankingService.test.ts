import "src/_test_utilities/consoleMock";
import { SkillsRankingService } from "./skillsRankingService";
import { SkillsRankingPhase, CompareAgainstGroup, ButtonOrderGroup } from "../types";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { getBackendUrl } from "src/envService";
import { FeaturesService } from "src/features/featuresService/FeaturesService";

jest.mock("src/envService", () => ({
  getFeatures: jest.fn(),
  getBackendUrl: jest.fn(),
}));

describe("SkillsRankingService", () => {
  let service: SkillsRankingService;
  const mockBackendUrl = "http://localhost:8000";

  beforeEach(() => {
    jest.clearAllMocks();
    (getBackendUrl as jest.Mock).mockReturnValue(mockBackendUrl);
    service = SkillsRankingService.getInstance();
  });

  describe("isSkillsRankingFeatureEnabled", () => {
    test.each([
      [true],
      [false],
    ])("should return %s when features service returns %s", (expected) => {
      // GIVEN envService.getFeatures is mocked to return the test features
      const isFeatureEnabledMock = jest
        .spyOn(FeaturesService.getInstance(), "isFeatureEnabled")
        .mockReturnValue(expected);

      // WHEN isSkillsRankingFeatureEnabled is called
      const result = service.isSkillsRankingFeatureEnabled();

      // THEN isFeatureEnabled should be called
      expect(isFeatureEnabledMock).toHaveBeenCalled();
      // AND the result should be as expected
      expect(result).toBe(expected);
    });
  });

  describe("getSkillsRankingState", () => {
    test("should fetch and return the skills ranking state", async () => {
      // GIVEN a session id and expected response
      const sessionId = 123;
      const expectedResponse = {
        session_id: sessionId,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        phase: SkillsRankingPhase.INITIAL,
        ranking: "80%",
        self_ranking: null,
      };

      // AND the server responds with the expected data
      const fetchSpy = setupAPIServiceSpy(200, expectedResponse, "application/json;charset=UTF-8");

      // WHEN getting the skills ranking state
      const result = await service.getSkillsRankingState(sessionId);

      // THEN it should return the expected response
      expect(result).toEqual(expectedResponse);
      // AND the fetch should be called with the correct parameters
      expect(fetchSpy).toHaveBeenCalledWith(
        `${mockBackendUrl}/conversations/${sessionId}/skills-ranking/state`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          expectedStatusCode: 200,
          serviceName: "SkillsRankingService",
          serviceFunction: "getSkillsRankingState",
          failureMessage: `Failed to get skills ranking state for session ${sessionId}`,
          expectedContentType: "application/json",
        })
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should return null when no state exists", async () => {
      // GIVEN a session id
      const sessionId = 123;

      // AND the server responds with an empty object
      const fetchSpy = setupAPIServiceSpy(200, null, "application/json;charset=UTF-8");

      // WHEN getting the skills ranking state
      const result = await service.getSkillsRankingState(sessionId);

      // THEN it should return null
      expect(result).toBeNull();
      // AND the fetch should be called with the correct parameters
      expect(fetchSpy).toHaveBeenCalledWith(
        `${mockBackendUrl}/conversations/${sessionId}/skills-ranking/state`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          expectedStatusCode: 200,
          serviceName: "SkillsRankingService",
          serviceFunction: "getSkillsRankingState",
          failureMessage: `Failed to get skills ranking state for session ${sessionId}`,
          expectedContentType: "application/json",
        })
      );
    });

    test("should handle fetch errors", async () => {
      // GIVEN a session id
      const sessionId = 123;

      // AND fetch rejects with an error
      setupAPIServiceSpy(500, "Server Error", "application/json;charset=UTF-8");

      // WHEN getting the skills ranking state
      // THEN it should throw an error
      await expect(service.getSkillsRankingState(sessionId)).rejects.toThrow();

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("updateSkillsRankingState", () => {
    test("should update and return the skills ranking state", async () => {
      // GIVEN a session id, new state and ranking
      const sessionId = 123;
      const newState = SkillsRankingPhase.EVALUATED;
      const selfRanking = "70%";
      const expectedResponse = {
        session_id: sessionId,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        phase: newState,
        ranking: "80%",
        self_ranking: selfRanking,
      };

      // AND the server responds with the expected data
      const fetchSpy = setupAPIServiceSpy(202, expectedResponse, "application/json;charset=UTF-8");

      // WHEN updating the skills ranking state
      const result = await service.updateSkillsRankingState(sessionId, newState, selfRanking);
      
      // AND the fetch should be called with the correct parameters
      expect(fetchSpy).toHaveBeenCalledWith(
        `${mockBackendUrl}/conversations/${sessionId}/skills-ranking/state`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          expectedStatusCode: 202,
          serviceName: "SkillsRankingService",
          serviceFunction: "updateSkillsRankingState",
          body: JSON.stringify({
            phase: newState,
            self_ranking: selfRanking
          }),
        })
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // THEN it should return the expected response
      expect(result).toEqual(expectedResponse);
    });

    test("should handle fetch errors", async () => {
      // GIVEN a session id, new state and ranking
      const sessionId = 123;
      const newState = SkillsRankingPhase.EVALUATED;
      const selfRanking = "70%";

      // AND fetch rejects with an error
      jest.spyOn(window, "fetch").mockRejectedValue(new Error("Server Error"));

      // WHEN updating the skills ranking state
      // THEN it should throw an error
      await expect(service.updateSkillsRankingState(sessionId, newState, selfRanking)).rejects.toThrow();
    });
  });

  describe("getRanking", () => {
    test("should fetch and return the ranking for a session", async () => {
      // GIVEN a session id and expected response
      const sessionId = 123;
      const expectedRanking = {
        ranking: "foo",
      };

      // AND the server responds with the expected data
      const fetchSpy = setupAPIServiceSpy(200, expectedRanking, "application/json;charset=UTF-8");

      // WHEN getting the ranking
      const result = await service.getRanking(sessionId);

      // THEN it should return the expected ranking
      expect(result).toEqual(expectedRanking);

      // AND the fetch should be called with the correct parameters
      expect(fetchSpy).toHaveBeenCalledWith(
        `${mockBackendUrl}/conversations/${sessionId}/skills-ranking/ranking`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          expectedStatusCode: 200,
          serviceName: "SkillsRankingService",
          serviceFunction: "getRanking",
          failureMessage: `Failed to get ranking for session ${sessionId}`,
          expectedContentType: "application/json",
        })
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle fetch errors", async () => {
      // GIVEN a session id
      const sessionId = 123;

      // AND fetch rejects with an error
      setupAPIServiceSpy(500, "Server Error", "application/json;charset=UTF-8");

      // WHEN getting the ranking
      // THEN it should throw an error
      await expect(service.getRanking(sessionId)).rejects.toThrow();

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
