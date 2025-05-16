// mute chatty console
import "src/_test_utilities/consoleMock";

import * as EnvServiceModule from "src/envService";
import { FeaturesService } from "./FeaturesService";

describe("OptionalFeaturesService", () => {
  let getFeaturesMock = jest.spyOn(EnvServiceModule, "getFeatures");

  beforeEach(() => {
    getFeaturesMock.mockReset();
    FeaturesService.getInstance().clearState();
  });

  describe("getConfig", () => {
    test("should return disabled config if no features string is set", () => {
      // GIVEN the features string is not set
      const givenFeatureId = "bar";
      getFeaturesMock.mockReturnValue("");

      // WHEN getConfig is called
      const actualConfig = FeaturesService.getInstance().getConfig(givenFeatureId);

      // THEN expect it to return enabled: false and empty config object.
      expect(actualConfig).toStrictEqual({
        enabled: false,
        config: {},
      });
    });

    test("should return disabled config if feature id is not in features string", () => {
      // GIVEN the features string is set, but the feature id is not in it.
      const givenFeatureId = "bar";
      getFeaturesMock.mockReturnValue(JSON.stringify({ foo: { enabled: true, config: {} } }));

      // WHEN getConfig is called
      const actualConfig = FeaturesService.getInstance().getConfig(givenFeatureId);

      // THEN expect it to return enabled: false and empty config object.
      expect(actualConfig).toStrictEqual({
        enabled: false,
        config: {},
      });
    });

    test("should return disabled config if features string is invalid", () => {
      // GIVEN the features string is set but invalid
      const givenFeatureId = "bar";
      getFeaturesMock.mockReturnValue("invalid");

      // WHEN getConfig is called
      const actualConfig = FeaturesService.getInstance().getConfig(givenFeatureId);

      // THEN expect it to return enabled: false and empty config object.
      expect(actualConfig).toStrictEqual({
        enabled: false,
        config: {},
      });

      // AND expect the error to be logged
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid features string",
        })
      );
    });

    test("should return actual config if feature id is in features string", () => {
      // GIVEN the features string is set and valid
      const givenFeatureId = "bar";
      const givenConfigDict = {
        enabled: true,
        config: { foo: "bar" },
      };

      getFeaturesMock.mockReturnValue(JSON.stringify({ [givenFeatureId]: givenConfigDict }));

      // WHEN getConfig is called
      const actualConfig = FeaturesService.getInstance().getConfig(givenFeatureId);

      // THEN expect it to return the actual config
      expect(actualConfig).toStrictEqual(givenConfigDict);
    });

    test("should cache the config", () => {
      // GIVEN the features string is set and valid
      const givenFeatureId = "bar";
      const givenConfigDict = { enabled: true, config: { foo: "bar" } };
      getFeaturesMock.mockReturnValue(JSON.stringify({ [givenFeatureId]: givenConfigDict }));

      const service = FeaturesService.getInstance();

      // WHEN getConfig is called twice
      const config1 = service.getConfig(givenFeatureId);
      const config2 = service.getConfig(givenFeatureId);

      // THEN expect the config to be cached
      expect(config1).toStrictEqual(config2);

      // AND expect the cache to be used
      expect(getFeaturesMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("isFeatureEnabled", () => {
    test("should return the correct enabled state", () => {
      // GIVEN the features string is set and valid
      const givenEnabledState = true;

      const getConfig = jest.spyOn(FeaturesService.getInstance(), "getConfig");

      getConfig.mockReturnValue({ enabled: givenEnabledState, config: {} });
      const service = FeaturesService.getInstance();

      // WHEN isFeatureEnabled is called
      const actualEnabledState = service.isFeatureEnabled("bar");

      // THEN expect it to return the correct enabled state
      expect(actualEnabledState).toBe(givenEnabledState);
    });
  });
});
