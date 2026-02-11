import { ConfigurationError } from "src/error/commonErrors";
import { FieldsConfig, RawFieldConfig } from "./defaultFieldsConfig";
import {
  EnumFieldDefinition,
  FieldDefinition,
  FieldType,
  MultipleSelectFieldDefinition,
  StringFieldDefinition,
} from "./types";

/**
 * Resolves a localized value from a map of locales to values.
 * Falls back to defaultLocale if the requested language is not available.
 */
export const resolveLocale = <T>(
  value: Record<string, T> | undefined,
  lang: string,
  defaultLocale: string
): T | undefined => {
  if (!value) {
    console.warn(`Missing localized value for '${lang}'`, value);
    return undefined;
  }
  return value[lang] ?? value[defaultLocale];
};

/**
 * Parses a fields configuration object into an array of localized and validated FieldDefinition objects.
 *
 * @param config - The raw fields configuration object (from JSON or default config)
 * @param lang - Active language code
 * @param defaultLocale - Fallback language code
 * @returns Array of validated FieldDefinition objects
 * @throws ConfigurationError if validation fails
 */
export const parseFieldsConfig = (config: FieldsConfig, lang: string, defaultLocale: string): FieldDefinition[] => {
  try {
    const fieldDefinitions = Object.entries(config).map(([name, rawField]) => {
      if (!rawField || typeof rawField !== "object") {
        throw new ConfigurationError(`Invalid field definition for '${name}'`);
      }
      const field = rawField as RawFieldConfig;

      // Resolve localized values BEFORE passing to constructors
      const label = resolveLocale<string>(field.label, lang, defaultLocale);

      if (!label) {
        throw new ConfigurationError(`Missing label for field '${name}' (lang=${lang})`);
      }

      const hasValues = "values" in field;
      const hasQuestionText = "questionText" in field;

      const localizedField = {
        ...field,
        name,
        label,
        questionText: hasQuestionText
          ? resolveLocale<string | undefined>(field.questionText, lang, defaultLocale)
          : undefined,
        validation: field.validation
          ? {
              ...field.validation,
              errorMessage: resolveLocale<string | undefined>(field.validation.errorMessage, lang, defaultLocale),
            }
          : undefined,
        values: hasValues ? resolveLocale<string[]>(field.values, lang, defaultLocale) : undefined,
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
          throw new ConfigurationError(`Invalid field type for '${name}': ${field["type"]}`);
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
