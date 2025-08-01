import { getFeatures } from "src/envService";

import { InvalidFeaturesConfig } from "./errors";

export interface FeatureConfig {
  enabled: boolean;
  config: Record<string, any>;
}

/**
 * Singleton class to manage features.
 */
export class FeaturesService {
  _featureId: string;

  constructor(featureId: string) {
    this._featureId = featureId;
  }

  /**
   * Get the configuration for a specific feature.
   * The ID is managed in the respective feature implementation.
   */
  protected getConfig(): FeatureConfig {
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

      if (!featuresConfig[this._featureId]) {
        console.debug(`Feature ID not found in features string ${this._featureId}`);
        return {
          enabled: false,
          config: {},
        };
      }

      const config: FeatureConfig = featuresConfig[this._featureId];

      this.validateConfig(config);

      return config;
    } catch (e) {
      console.error(new InvalidFeaturesConfig("Invalid features string", { cause: e }));

      return {
        enabled: false,
        config: {},
      };
    }
  }

  protected isFeatureEnabled(): boolean {
    const config = this.getConfig();
    return config.enabled;
  }

  protected validateConfig(config: any): void {
    if (typeof config.enabled !== "boolean") {
      console.error(new InvalidFeaturesConfig("Invalid config: enabled must be a boolean"));
      throw new InvalidFeaturesConfig("Invalid config: enabled must be a boolean");
    }

    if (typeof config.featureName !== "string") {
      console.error(new InvalidFeaturesConfig("Invalid config: featureName must be a string"));
      throw new InvalidFeaturesConfig("Invalid config: featureName must be a string");
    }

    if (typeof config.config !== "object") {
      console.error(new InvalidFeaturesConfig("Invalid config: config must be an object"));
      throw new InvalidFeaturesConfig("Invalid config: config must be an object");
    }
  }

  protected getFeatureAPIPrefix(featureId: string): string {
    return `features/${featureId}`;
  }
}
