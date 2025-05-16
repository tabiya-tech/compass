import { getFeatures } from "src/envService";

import { InvalidFeaturesConfig } from "./errors";

type Config = {
  enabled: boolean;
  config: Record<string, any>;
};

/**
 * Singleton class to manage features.
 */
export class FeaturesService {
  private static instance: FeaturesService;
  private readonly _state: Map<string, Config>;

  private constructor() {
    this._state = new Map<string, Config>();
  }

  public static getInstance(): FeaturesService {
    if (!FeaturesService.instance) {
      FeaturesService.instance = new FeaturesService();
    }
    return FeaturesService.instance;
  }

  /**
   * Get the configuration for a specific feature.
   * The ID is managed in the respective feature implementation.
   *
   * @param featureId - The ID of the feature to retrieve the configuration for.
   */
  public getConfig(featureId: string): Config {
    if (this._state.has(featureId)) {
      return this._state.get(featureId)!;
    }

    const featuresConfigString = getFeatures();

    try {
      // If no featured string, return empty config
      if (!featuresConfigString) {
        console.debug("No features string set");
        return {
          enabled: false,
          config: {},
        };
      }

      // Parse the features string
      // The string is expected to be a JSON object with feature IDs as keys
      const featuresConfig = JSON.parse(featuresConfigString);

      if (!featuresConfig[featureId]) {
        console.debug(`Feature ID not found in features string ${featureId}`);
        return {
          enabled: false,
          config: {},
        };
      }

      const config: Config = featuresConfig[featureId];

      this.validateConfig(config);

      this._state.set(featureId, config);

      return config;
    } catch (e) {
      console.error(new InvalidFeaturesConfig("Invalid features string", { cause: e }));

      return {
        enabled: false,
        config: {},
      };
    }
  }

  public isFeatureEnabled(featureId: string): boolean {
    const config = this.getConfig(featureId);
    return config.enabled;
  }

  public clearState(): void {
    this._state.clear();
  }

  private validateConfig(config: any): void {
    if (typeof config.enabled !== "boolean") {
      throw new Error("Invalid config: enabled must be a boolean");
    }

    if (typeof config.config !== "object") {
      throw new Error("Invalid config: config must be an object");
    }
  }
}
