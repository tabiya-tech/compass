import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  EnumFieldDefinition,
  FieldDefinition,
  FieldType,
  MultipleSelectFieldDefinition,
  StringFieldDefinition,
} from "./types";
import { parse } from "yaml";
import { ConfigurationError } from "src/error/commonErrors";
import { DEFAULT_LOCALE } from "src/i18n/constants";
import { customFetch } from "src/utils/customFetch/customFetch";

// Base path for configs
const CONFIG_BASE_PATH = "/data/config";
export const CONFIG_PATH = "/data/config/fields.yaml";

export const useFieldsConfig = () => {
  const { i18n } = useTranslation(); // i18n gives us the active language
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Build localized path (e.g., /data/config/fields-en-gb.yaml)
        const lang = i18n.language || DEFAULT_LOCALE;
        const configPath = `${CONFIG_BASE_PATH}/fields-${lang}.yaml`;

        const response = await customFetch(configPath, {
          expectedStatusCode: [200, 204],
          serviceName: "SensitiveDataService",
          serviceFunction: "useFieldsConfig",
          failureMessage: `Failed to fetch fields configuration from ${configPath}`,
          authRequired: false,
          retryOnFailedToFetch: true,
        });

        const yamlText = await response.text();
        const parsedDefinitions: FieldDefinition[] = parseYamlConfig(yamlText);

        setFields(parsedDefinitions);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err : new Error("Unknown error loading configuration"));
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [i18n.language]); // re-run when the language changes

  return { fields, loading, error };
};

/**
 * Parses a YAML configuration string into a FieldsConfig object.
 */
export const parseYamlConfig = (yamlText: string): FieldDefinition[] => {
  try {
    const yamlJson = parse(yamlText) as Record<string, FieldDefinition>;

    const fieldDefinitions = Object.entries(yamlJson).map(
      ([name, field]: [string, FieldDefinition]) => {
        switch (field.type) {
          case FieldType.String:
            return new StringFieldDefinition({ ...field, name });
          case FieldType.Enum:
            return new EnumFieldDefinition({ ...field, name });
          case FieldType.MultipleSelect:
            return new MultipleSelectFieldDefinition({ ...field, name });
          default:
            throw new Error("Invalid field type");
        }
      }
    );

    const dataKeys: Map<string, boolean> = new Map();
    fieldDefinitions.forEach((field) => {
      if (dataKeys.has(field.dataKey)) {
        throw new ConfigurationError(`Duplicate dataKey '${field.dataKey}'`);
      }
      dataKeys.set(field.dataKey, true);
    });

    return fieldDefinitions;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to parse fields configuration");
  }
};
