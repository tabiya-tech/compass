import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useFieldsConfig } from "./useFieldsConfig";
import * as EnvService from "src/envService";

// Mock the DEFAULT_LOCALE constant to ensure consistent behavior in tests
jest.mock("src/i18n/constants", () => ({
  ...jest.requireActual("src/i18n/constants"),
  DEFAULT_LOCALE: "en-US",
}));

// Mock component to test the hook
const TestComponent = () => {
  const { fields, loading, error } = useFieldsConfig();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>Fields loaded: {fields.length}</div>;
};

describe("Fields Configuration Validation", () => {
  let getSensitiveDataFieldsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to empty string (use default config)
    getSensitiveDataFieldsSpy = jest.spyOn(EnvService, "getSensitiveDataFields").mockReturnValue("");
  });

  // GIVEN a valid configuration
  test("should load and validate a correct configuration", async () => {
    // GIVEN a valid JSON config
    const validConfig = {
      stringFieldName: {
        dataKey: "string_field_name",
        type: "STRING",
        required: true,
        label: { "en-US": "String Field" },
        validation: {
          pattern: "^[\\p{L}]{1,48}$",
          errorMessage: { "en-US": "String Field should contain only letters" },
        },
      },
    };

    getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(validConfig));

    // WHEN the component is rendered
    render(<TestComponent />);

    // THEN the component should render successfully
    await waitFor(() => {
      expect(screen.getByText(/Fields loaded: 1/)).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with duplicate dataKeys
  test("should fail validation when dataKeys are not unique", async () => {
    // GIVEN a config with duplicate dataKeys
    const invalidConfig = {
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

    getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(invalidConfig));

    // WHEN the component is rendered
    render(<TestComponent />);

    // THEN the component should show an error about duplicate keys
    await waitFor(() => {
      expect(screen.getByText(/Error: Duplicate dataKey 'same_key'/i)).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with wrong field types
  test("should fail validation when field types are incorrect", async () => {
    // GIVEN a config with incorrect field types (values must be array, not string)
    const invalidConfig = {
      enumField: {
        dataKey: "enum_field",
        type: "ENUM",
        required: true,
        label: { "en-US": "Enum Field" },
        values: { "en-US": "not-an-array" }, // Should be an array
      },
    };

    getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(invalidConfig));

    // WHEN the component is rendered
    render(<TestComponent />);

    // THEN the component should show an error about validation not being allowed for ENUM
    await waitFor(() => {
      expect(screen.getByText(/Error: SensitiveData: Field values must be an array of strings/i)).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with missing required fields
  test("should fail validation when required fields are missing", async () => {
    // GIVEN a config with missing 'required' field
    const invalidConfig = {
      stringField: {
        dataKey: "string_field",
        type: "STRING",
        // missing 'required' field
        label: { "en-US": "String Field" },
      },
    };

    getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(invalidConfig));

    // WHEN the component is rendered
    render(<TestComponent />);

    // THEN the component should show an error about missing required fields
    await waitFor(() => {
      expect(
        screen.getByText(/Error: SensitiveData: Field 'required' is required and must be a boolean/i)
      ).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with wrong ENUM setup
  test("should fail validation when ENUM field has no values", async () => {
    // GIVEN a config with ENUM field missing values
    const invalidConfig = {
      enumField: {
        dataKey: "enum_field",
        type: "ENUM",
        required: true,
        label: { "en-US": "Enum Field" },
        // missing 'values' field
      },
    };

    getSensitiveDataFieldsSpy.mockReturnValue(JSON.stringify(invalidConfig));

    // WHEN the component is rendered
    render(<TestComponent />);

    // THEN the component should show an error about missing values
    await waitFor(() => {
      expect(screen.getByText(/Error: SensitiveData: Field values must be an array of strings/i)).toBeInTheDocument();
    });
  });

  // Test that default config is used when env is not set
  test("should use default config when FRONTEND_SENSITIVE_DATA_FIELDS is not set", async () => {
    // GIVEN FRONTEND_SENSITIVE_DATA_FIELDS is empty (default)
    getSensitiveDataFieldsSpy.mockReturnValue("");

    // WHEN the component is rendered
    render(<TestComponent />);

    // THEN the component should load the default fields (6 fields)
    await waitFor(() => {
      expect(screen.getByText(/Fields loaded: 6/)).toBeInTheDocument();
    });
  });
});
