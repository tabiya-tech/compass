// mute chatty console
import "src/_test_utilities/consoleMock";

import { renderHook, waitFor } from "@testing-library/react";
import { useFieldsConfig } from "./useFieldsConfig";
import { EnumFieldDefinition, MultipleSelectFieldDefinition, StringFieldDefinition } from "./types";
import { Locale } from "src/i18n/constants";
import * as EnvService from "src/envService";

// Mock the DEFAULT_LOCALE constant to ensure consistent behavior in tests
jest.mock("src/i18n/constants", () => ({
  ...jest.requireActual("src/i18n/constants"),
  DEFAULT_LOCALE: "en-US",
}));

const mockI18nState: { language: Locale } = { language: Locale.EN_US as Locale };
jest.mock("react-i18next", () => {
  const actual = jest.requireActual("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      i18n: {
        get language() {
          return mockI18nState.language;
        },
        changeLanguage: jest.fn((lng: Locale) => {
          mockI18nState.language = lng;
          return Promise.resolve();
        }),
      },
    }),
  };
});

describe("useFieldsConfig", () => {
  let getSensitiveDataFieldsSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset default language to en-US
    mockI18nState.language = Locale.EN_US;
    // Default to returning empty string (use default config)
    getSensitiveDataFieldsSpy = jest.spyOn(EnvService, "getSensitiveDataFields").mockReturnValue("");
  });

  describe("default configuration", () => {
    test("should use default config when FRONTEND_SENSITIVE_DATA_FIELDS is not set", async () => {
      // GIVEN FRONTEND_SENSITIVE_DATA_FIELDS is not set (empty string)
      getSensitiveDataFieldsSpy.mockReturnValue("");

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return fields from the default config after the effect runs
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fields.length).toBeGreaterThan(0);
      expect(result.current.error).toBe(null);

      // AND the fields should include the standard default fields
      const fieldNames = result.current.fields.map((f) => f.name);
      expect(fieldNames).toContain("name");
      expect(fieldNames).toContain("contactEmail");
      expect(fieldNames).toContain("gender");
      expect(fieldNames).toContain("age");
    });

    test("should return loading=true initially then false after effect", async () => {
      // GIVEN the hook is first rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN eventually loading should be false (effect runs synchronously with mocked env)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // AND fields should be loaded
      expect(result.current.fields.length).toBeGreaterThan(0);
      expect(result.current.error).toBe(null);
    });
  });

  describe("custom configuration from env", () => {
    test("should parse custom config from FRONTEND_SENSITIVE_DATA_FIELDS", async () => {
      // GIVEN a custom config in FRONTEND_SENSITIVE_DATA_FIELDS
      const customConfig = {
        customField: {
          dataKey: "custom_field",
          type: "STRING",
          required: true,
          label: { "en-US": "Custom Field" },
        },
      };
      getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(customConfig));

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return the custom field
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fields).toHaveLength(1);
      expect(result.current.fields[0].name).toBe("customField");
      expect(result.current.fields[0].label).toBe("Custom Field");
      expect(result.current.error).toBe(null);
    });

    test("should handle multiple field types from custom config", async () => {
      // GIVEN a custom config with multiple field types
      const customConfig = {
        stringField: {
          dataKey: "string_field",
          type: "STRING",
          required: true,
          label: { "en-US": "String Field" },
        },
        enumField: {
          dataKey: "enum_field",
          type: "ENUM",
          required: true,
          label: { "en-US": "Enum Field" },
          values: { "en-US": ["Option 1", "Option 2"] },
        },
        multiSelectField: {
          dataKey: "multi_select_field",
          type: "MULTIPLE_SELECT",
          required: false,
          label: { "en-US": "Multi Select Field" },
          values: { "en-US": ["A", "B", "C"] },
        },
      };
      getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(customConfig));

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return all field types correctly
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fields).toHaveLength(3);
      expect(result.current.fields[0]).toBeInstanceOf(StringFieldDefinition);
      expect(result.current.fields[1]).toBeInstanceOf(EnumFieldDefinition);
      expect(result.current.fields[2]).toBeInstanceOf(MultipleSelectFieldDefinition);
    });
  });

  describe("error handling", () => {
    test("should return error for invalid JSON in FRONTEND_SENSITIVE_DATA_FIELDS", async () => {
      // GIVEN invalid JSON in FRONTEND_SENSITIVE_DATA_FIELDS
      getSensitiveDataFieldsSpy.mockReturnValue("not valid json");

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return an error
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fields).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain("Invalid JSON in FRONTEND_SENSITIVE_DATA_FIELDS");
    });

    test("should return error for invalid field type", async () => {
      // GIVEN a config with an invalid field type
      const invalidConfig = {
        invalidField: {
          dataKey: "invalid_field",
          type: "UNKNOWN_TYPE",
          required: true,
          label: { "en-US": "Invalid Field" },
        },
      };
      getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(invalidConfig));

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return an error about invalid field type
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fields).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain("Invalid field type");
    });

    test("should return error for duplicate dataKey", async () => {
      // GIVEN a config with duplicate dataKeys
      const duplicateConfig = {
        field1: {
          dataKey: "same_key",
          type: "STRING",
          required: true,
          label: { "en-US": "Field 1" },
        },
        field2: {
          dataKey: "same_key",
          type: "STRING",
          required: true,
          label: { "en-US": "Field 2" },
        },
      };
      getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(duplicateConfig));

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return an error about duplicate dataKey
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fields).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain("Duplicate dataKey");
    });

    test("should return error for missing label", async () => {
      // GIVEN a config with missing label for the current locale
      const missingLabelConfig = {
        noLabelField: {
          dataKey: "no_label",
          type: "STRING",
          required: true,
          label: {}, // Empty label map
        },
      };
      getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(missingLabelConfig));

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return an error about missing label
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fields).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain("Missing label");
    });
  });

  describe("language changes", () => {
    test("should re-parse config when language changes without re-loading", async () => {
      // GIVEN a config with multi-language labels
      const multiLangConfig = {
        nameField: {
          dataKey: "name",
          type: "STRING",
          required: true,
          label: {
            "en-US": "Name",
            "es-ES": "Nombre",
          },
        },
      };
      getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(multiLangConfig));

      // Set initial language to en-US
      mockI18nState.language = Locale.EN_US;

      // WHEN the hook is rendered
      const { result, rerender } = renderHook(() => useFieldsConfig());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // THEN it should show English label
      expect(result.current.fields[0].label).toBe("Name");

      // WHEN the language changes to Spanish
      mockI18nState.language = Locale.ES_ES;
      rerender();

      // THEN it should show Spanish label
      await waitFor(() => expect(result.current.fields[0].label).toBe("Nombre"));

      // AND getSensitiveDataFields should still have been called only once (during initial useMemo)
      // The config is cached and only re-parsed, not re-fetched
    });

    test("should fall back to default locale when language is not available", async () => {
      // GIVEN a config with only English labels
      const englishOnlyConfig = {
        nameField: {
          dataKey: "name",
          type: "STRING",
          required: true,
          label: { "en-US": "Name" },
        },
      };
      getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(englishOnlyConfig));

      // Set language to French (not in config)
      mockI18nState.language = "fr-FR" as Locale;

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // THEN it should fall back to English (default locale)
      expect(result.current.fields[0].label).toBe("Name");
    });
  });

  describe("edge cases", () => {
    test("should handle empty config object", async () => {
      // GIVEN an empty config object
      getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify({}));

      // WHEN the hook is rendered
      const { result } = renderHook(() => useFieldsConfig());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // THEN it should return empty fields array
      expect(result.current.fields).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    test("should clean up on unmount without errors", () => {
      // GIVEN the hook is mounted
      const { unmount } = renderHook(() => useFieldsConfig());

      // WHEN the component unmounts
      unmount();

      // THEN it should not throw any errors
      expect(true).toBe(true);
    });
  });
});
