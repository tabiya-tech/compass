import * as EnvServiceModule from "src/envService";
import { SkillsRankingService } from "./skillsRankingService";

describe("SkillsRankingService", () => {
  describe("SkillsRankingService", () => {
    test.skip.each([
      [true, "true"],
      [true, "TRUE"],
      [true, "True"],
      [true, "tRuE"],

      [false, "false"],
      [false, "FALSE"],
      [false, "False"],
      [false, "fAlSe"],
      [false, ""],

      [false, "bar"],
    ])("should return '%s' for '%s'", (expected, input) => {
      // GIVEN envService.getSkillsRankingEnabled is mocked to return input
      const getSkillsRankingEnabledMock = jest.spyOn(EnvServiceModule, "getFeatures").mockReturnValue(input);

      // WHEN isSkillsRankingFeatureEnabled is called
      const isSkillsRankingEnabled = SkillsRankingService.getInstance().isSkillsRankingFeatureEnabled();

      // THEN envService.getSkillsRankingEnabled should be called
      expect(getSkillsRankingEnabledMock).toHaveBeenCalled()

      // AND the result should be as expected
      expect(isSkillsRankingEnabled).toBe(expected);
    });
  });
});
