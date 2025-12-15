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
export const CONFIG_PATH = "/data/config/fields.yaml";

// Resolves a localized value from a map of locales to values.
const resolveLocale = <T>(value: Record<string, T> | undefined, lang: string, defaultLocale: string): T | undefined => {
  if (!value) return undefined;
  return value[lang] ?? value[defaultLocale];
};

/**
 * A hook to load and expose localized field configurations.
 *
 * - Fetches the YAML config ONCE
 * - Re-parses it when the language changes
 * - Returns validated FieldDefinition objects
 */
export const useFieldsConfig = () => {
  const { i18n } = useTranslation(); // i18n gives us the active language

  const [rawYaml, setRawYaml] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch the config file once. The file is language-agnostic and contains all translations.
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await customFetch(CONFIG_PATH, {
          expectedStatusCode: [200, 204],
          serviceName: "SensitiveDataService",
          serviceFunction: "useFieldsConfig",
          failureMessage: `Failed to fetch fields configuration from ${CONFIG_PATH}`,
          authRequired: false,
          retryOnFailedToFetch: true,
        });

        setRawYaml(await response.text());
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err : new Error("Unknown error loading configuration"));
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Reparse the config whenever the active language changes. No re-fetching happens here.
  useEffect(() => {
    if (!rawYaml) return;

    try {
      const lang = i18n.language || DEFAULT_LOCALE;
      const parsedDefinitions = parseYamlConfig(rawYaml, lang, DEFAULT_LOCALE);

      setFields(parsedDefinitions);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err : new Error("Unknown error parsing configuration"));
    } finally {
      setLoading(false);
    }
  }, [rawYaml, i18n.language]);

  return { fields, loading, error };
};


// Raw config as it appears in YAML, before localization.
// It mirrors the data that will be passed into BaseFieldDefinition and its subclasses,
// with the difference that some user-facing strings are stored as locale maps.
type RawFieldConfig = {
  type: FieldType;
  dataKey: string;
  required: boolean;
  label: Record<string, string>;
  questionText?: Record<string, string>;
  validation?: {
    pattern?: string;
    errorMessage?: Record<string, string>;
  };
  values?: Record<string, string[]>;
  defaultValue?: string;
};

/**
 * Parses the unified, multi-language fields YAML into
 * an array of localized and validated FieldDefinition objects.
 *
 * @param yamlText - Raw YAML string loaded from fields.yaml
 * @param lang - Active language code
 * @param defaultLocale - Fallback language code
 */
export const parseYamlConfig = (yamlText: string, lang: string, defaultLocale: string): FieldDefinition[] => {
  try {
    const yamlJson = parse(yamlText) as Record<string, RawFieldConfig>;

    const fieldDefinitions = Object.entries(yamlJson).map(([name, rawField]) => {
      if (!rawField || typeof rawField !== "object") {
        throw new ConfigurationError(`Invalid field definition for '${name}'`);
      }
      const field = rawField as RawFieldConfig;

      // Resolve localized values BEFORE passing to constructors
      const label = resolveLocale<string>(field.label, lang, defaultLocale);

      if (!label) {
        throw new ConfigurationError(`Missing label for field '${name}' (lang=${lang})`);
      }

      const localizedField = {
        ...field,
        name,
        label,
        questionText: resolveLocale<string | undefined>(field.questionText, lang, defaultLocale),
        validation: field.validation
          ? {
              ...field.validation,
              errorMessage: resolveLocale<string | undefined>(
                field.validation.errorMessage,
                lang,
                defaultLocale,
              ),
            }
          : undefined,
        values: resolveLocale<string[]>(field.values, lang, defaultLocale),
      };

      // Instantiate the correct FieldDefinition subclass.
      // Each constructor validates its own structure.
      switch (field.type) {
        case FieldType.String:
          return new StringFieldDefinition(localizedField);
        case FieldType.Enum:
          return new EnumFieldDefinition(localizedField);
        case FieldType.MultipleSelect:
          return new MultipleSelectFieldDefinition(localizedField);
        default:
          throw new ConfigurationError(`Invalid field type for '${name}': ${field.type}`);
      }
    });

    // Ensure dataKeys are unique
    const dataKeys = new Set<string>();
    fieldDefinitions.forEach((field) => {
      if (dataKeys.has(field.dataKey)) {
        throw new ConfigurationError(`Duplicate dataKey '${field.dataKey}'`);
      }
      dataKeys.add(field.dataKey);
    });

    return fieldDefinitions;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
