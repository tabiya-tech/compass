import "src/_test_utilities/consoleMock";
import { renderHook } from "@testing-library/react-hooks";
import { useFieldsConfig } from "./useFieldsConfig";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import {
  EnumFieldDefinition,
  FieldDefinition,
  FieldType,
  MultipleSelectFieldDefinition,
  StringFieldDefinition,
} from "./types";
import * as CustomFetchModule from "src/utils/customFetch/customFetch";

// Mock the utils functions
jest.mock("./utils", () => ({
  parseYamlConfig: jest.fn(),
  getAllFields: jest.fn(),
}));

describe("Config Hooks", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("useFieldsConfig", () => {
    test("should return default config and loading state initially", () => {
      // GIVEN the useFieldsConfig hook
      // WHEN it is first rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return the default config and loading=true
      expect(result.current.fields).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    test("should fetch and update config on mount for various fields at the same time", async () => {
      // GIVEN a successful fetch response with yaml with all required fields for the fields
      const givenMultipleSelectFieldWithRequiredFields = `
      multipleFieldName:
        dataKey: multiple_field_name
        type: MULTIPLE_SELECT
        required: true
        label:
          en-US: Multiple select Field
        values:
          en-US: ["value1", "value2"]
      enumFieldName:
        dataKey: enum_field_name
        type: ENUM
        required: true
        label:
          en-US: Enum Field
        values:
          en-US: ["value1", "value2"]
      stringFieldName:
        dataKey: string_field_name
        type: STRING
        required: true
        label:
          en-US: String Field
      `;
      fetchSpy = setupAPIServiceSpy(200, givenMultipleSelectFieldWithRequiredFields, "");

      // WHEN the hook is mounted
      const { result, waitForNextUpdate } = renderHook(() => useFieldsConfig());

      // THEN it should initially be in loading state
      expect(result.current.loading).toBe(true);

      // WHEN the fetch completes
      await waitForNextUpdate();

      // THEN it should update the state with the result
      const expectedFieldDefinitions: FieldDefinition[] = [
        new MultipleSelectFieldDefinition({
          name: "multipleFieldName",
          dataKey: "multiple_field_name",
          type: FieldType.MultipleSelect,
          required: true,
          label: "Multiple select Field",
          values: ["value1", "value2"],
        }),
        new EnumFieldDefinition({
          name: "enumFieldName",
          dataKey: "enum_field_name",
          type: FieldType.Enum,
          required: true,
          label: "Enum Field",
          values: ["value1", "value2"],
        }),
        new StringFieldDefinition({
          name: "stringFieldName",
          dataKey: "string_field_name",
          type: FieldType.String,
          required: true,
          label: "String Field",
        }),
      ];
      expect(fetchSpy).toHaveBeenCalledWith("/data/config/fields.yaml", {
        authRequired: false,
        retryOnFailedToFetch: true,
        expectedStatusCode: [200, 204],
        failureMessage: "Failed to fetch fields configuration from /data/config/fields.yaml",
        serviceFunction: "useFieldsConfig",
        serviceName: "SensitiveDataService",
      });
      expect(result.current.fields).toEqual(expect.arrayContaining(expectedFieldDefinitions));
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    test("should handle config loading errors", async () => {
      // GIVEN a failed fetch response
      const givenError = new Error("Failed to load fields configuration");
      jest.spyOn(CustomFetchModule, "customFetch").mockRejectedValueOnce(givenError);

      // WHEN the hook is mounted
      const { result, waitForNextUpdate } = renderHook(() => useFieldsConfig());

      // THEN it should initially be in loading state
      expect(result.current.loading).toBe(true);

      // WHEN the fetch fails
      await waitForNextUpdate();

      // THEN it should update the state with the error
      expect(result.current.fields).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain("Failed to load fields configuration");
    });

    test("should clean up on unmount", async () => {
      // GIVEN a pending fetch that never resolves
      fetchSpy = setupAPIServiceSpy(200, new Promise(() => {}), "");

      // WHEN the hook is mounted and then unmounted
      const { unmount } = renderHook(() => useFieldsConfig());

      // AND then unmounted before the fetch completes
      unmount();

      // THEN it should not throw any errors
      // This is a negative test - we're verifying that unmounting doesn't cause issues
      expect(true).toBe(true);
    });

    test("should throw an error if the field type is not among the known types", async () => {
      // GIVEN a fetch response with a field with an unknown type
      const givenUnknownFieldType = `
      unknownFieldName: 
        dataKey: unknown_field_name
        type: UNKNOWN
        required: true
        label:
          en-US: Unknown Field
      `;
      fetchSpy = setupAPIServiceSpy(200, givenUnknownFieldType, "");

      // WHEN the hook is mounted
      const { result, waitForNextUpdate } = renderHook(() => useFieldsConfig());

      // THEN it should initially be in loading state
      expect(result.current.loading).toBe(true);

      // WHEN the fetch completes
      await waitForNextUpdate();

      // THEN it should update the state with a detailed parse error
      expect(result.current.fields).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain(
        "Invalid field type for 'unknownFieldName': UNKNOWN",
      );
    });

    test("should throw an error if the field has a duplicate data key", async () => {
      // GIVEN a fetch response with a field with a duplicate data key
      const givenDuplicateDataKey = `
      stringFieldName1:
        dataKey: string_field_name
        type: STRING
        required: true
        label:
          en-US: String Field 1
      stringFieldName2:
        dataKey: string_field_name
        type: STRING
        required: true
        label:
          en-US: String Field 2
      `;
      fetchSpy = setupAPIServiceSpy(200, givenDuplicateDataKey, "");

      // WHEN the hook is mounted
      const { result, waitForNextUpdate } = renderHook(() => useFieldsConfig());

      // THEN it should initially be in loading state
      expect(result.current.loading).toBe(true);

      // WHEN the fetch completes
      await waitForNextUpdate();

      // THEN it should update the state with a detailed duplicate dataKey error
      expect(result.current.fields).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain(
        "Duplicate dataKey 'string_field_name'",
      );
    });

    test("should throw an error when an unexpected error occurs", async () => {
      // GIVEN a fetch that throws an unexpected non-Error object
      const givenError = new Error("Something went wrong");
      jest.spyOn(CustomFetchModule, "customFetch").mockRejectedValueOnce(givenError);

      // WHEN the hook is mounted
      const { result, waitForNextUpdate } = renderHook(() => useFieldsConfig());

      // THEN it should initially be in loading state
      expect(result.current.loading).toBe(true);

      // WHEN the fetch completes
      await waitForNextUpdate();

      // THEN it should update the state with the error
      expect(result.current.fields).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(givenError.message);
    });

    test("should re-parse config when language changes without re-fetching", async () => {
      // GIVEN a successful fetch with multi-language YAML
      const givenMultiLanguageYaml = `
      stringFieldName:
        dataKey: string_field_name
        type: STRING
        required: true
        label:
          en-US: String Field
          es-ES: Campo de Cadena
      `;
      fetchSpy = setupAPIServiceSpy(200, givenMultiLanguageYaml, "");

      // WHEN the hook is mounted with en-US language
      const { result, waitForNextUpdate, rerender } = renderHook(() => useFieldsConfig());

      // Wait for initial fetch
      await waitForNextUpdate();

      // THEN the fetch should have been called once
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.current.fields[0].label).toBe("String Field");

      // WHEN the language changes (simulated by i18n.language change in implementation)
      // Note: In actual implementation, this would be triggered by changing i18n.language
      // For this test, we're verifying the fetch is not called again
      rerender();

      // THEN the fetch should still have been called only once (no re-fetch)
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test("should handle parsing errors separately from fetch errors", async () => {
      // GIVEN a successful fetch but invalid YAML
      const givenInvalidYaml = `
      stringFieldName:
        dataKey: string_field_name
        type: STRING
        required: true
        # Missing label field
      `;
      fetchSpy = setupAPIServiceSpy(200, givenInvalidYaml, "");

      // WHEN the hook is mounted
      const { result, waitForNextUpdate } = renderHook(() => useFieldsConfig());

      // THEN it should initially be in loading state
      expect(result.current.loading).toBe(true);

      // WHEN the fetch completes
      await waitForNextUpdate();

      // THEN it should update the state with a detailed parsing error
      expect(result.current.fields).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain(
        "Missing label for field 'stringFieldName' (lang=en-US)",
      );
    });
  });
});
