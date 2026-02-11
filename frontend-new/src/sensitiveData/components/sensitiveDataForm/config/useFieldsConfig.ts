import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FieldDefinition } from "./types";
import { DEFAULT_FIELDS_CONFIG, FieldsConfig } from "./defaultFieldsConfig";
import { parseFieldsConfig } from "./parseFieldsConfig";
import { getSensitiveDataFields } from "src/envService";
import { DEFAULT_LOCALE } from "src/i18n/constants";

/**
 * Gets the fields configuration from environment or returns default.
 * Returns the parsed JSON object or the default config if env is not set.
 */
const getFieldsConfigFromEnv = (): FieldsConfig => {
  const envValue = getSensitiveDataFields();

  // If no env value is set, use the default configuration
  if (!envValue) {
    return DEFAULT_FIELDS_CONFIG;
  }

  // Parse the JSON from the env value
  try {
    const parsed = JSON.parse(envValue);

    // Ensure the parsed value is a non-null plain object (not an array or primitive)
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        'FRONTEND_SENSITIVE_DATA_FIELDS must be a JSON object (e.g. { "fieldKey": { ... } }), ' +
          "but the parsed value was not an object."
      );
    }

    return parsed as FieldsConfig;
  } catch (error) {
    // Re-throw with more context for JSON parse and validation errors
    throw new Error(`Invalid JSON in FRONTEND_SENSITIVE_DATA_FIELDS: ${(error as Error).message}`);
  }
};

/**
 * A hook to load and expose localized field configurations.
 *
 * - Loads config from env.js (FRONTEND_SENSITIVE_DATA_FIELDS) or uses default
 * - Re-parses when the language changes
 * - Returns validated FieldDefinition objects
 */
export const useFieldsConfig = () => {
  const { i18n } = useTranslation();

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize both the raw config and any loading error in a single computation
  // to avoid calling getFieldsConfigFromEnv() twice
  const { rawConfig, configError } = useMemo<{ rawConfig: FieldsConfig | null; configError: Error | null }>(() => {
    try {
      return { rawConfig: getFieldsConfigFromEnv(), configError: null };
    } catch (err) {
      return {
        rawConfig: null,
        configError: err instanceof Error ? err : new Error("Unknown error loading configuration"),
      };
    }
  }, []);

  // Parse the config whenever the language changes
  useEffect(() => {
    // If we had an error loading the config, propagate it
    if (configError) {
      setError(configError);
      setLoading(false);
      return;
    }

    if (!rawConfig) {
      setError(new Error("Failed to load configuration"));
      setLoading(false);
      return;
    }

    try {
      // Clear any previous parsing error before re-parsing on language change
      setError(null);

      const lang = i18n.language || DEFAULT_LOCALE;
      const parsedDefinitions = parseFieldsConfig(rawConfig, lang, DEFAULT_LOCALE);

      setFields(parsedDefinitions);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err : new Error("Unknown error parsing configuration"));
    } finally {
      setLoading(false);
    }
  }, [rawConfig, configError, i18n.language]);

  return { fields, loading, error };
};
