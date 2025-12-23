import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useFieldsConfig } from "./useFieldsConfig";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { ConfigurationError } from "src/error/commonErrors";

// Mock component to test the hook
const TestComponent = () => {
  const { fields, loading, error } = useFieldsConfig();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>Fields loaded: {fields.length}</div>;
};

describe("Fields Configuration Validation", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // GIVEN a valid configuration
  test("should load and validate a correct configuration", async () => {
    // GIVEN the example config from fields.example.yaml
    const validConfig = `
    stringFieldName:
      dataKey: string_field_name
      type: STRING
      required: true
      label:
        en-US: String Field
      validation:
        pattern: ^[\\p{L}]{1,48}$
        errorMessage:
          en-US: String Field should contain only letters
    `;

    // WHEN the config is fetched
    setupAPIServiceSpy(200, validConfig, "");

    // THEN the component should render successfully
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Fields loaded:/)).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with duplicate dataKeys
  test("should fail validation when dataKeys are not unique", async () => {
    // GIVEN a config with duplicate dataKeys
    const invalidConfig = `
    field1:
      dataKey: same_key
      type: STRING
      required: true
      label:
        en-US: Field 1
    field2:
      dataKey: same_key
      type: STRING
      required: true
      label:
        en-US: Field 2
    `;

    // WHEN the config is fetched
    setupAPIServiceSpy(200, invalidConfig, "");

    // THEN the component should show an error about duplicate keys
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Duplicate dataKey 'same_key'/i)).toBeInTheDocument();
    });

    // AND expect an error to be logged to the console
    expect(console.error).toHaveBeenCalledWith(new ConfigurationError(`Duplicate dataKey 'same_key'`));
  });

  // GIVEN an invalid configuration with wrong field types
  test("should fail validation when field types are incorrect", async () => {
    // GIVEN a config with incorrect field types
    const invalidConfig = `
    enumField:
      dataKey: enum_field
      type: ENUM
      required: true
      label:
        en-US: Enum Field
      values:
        en-US: not-an-array
      validation:
        pattern: .*
        errorMessage:
          en-US: This should not be here
    `;

    // WHEN the config is fetched
    setupAPIServiceSpy(200, invalidConfig, "");

    // THEN the component should show an error about validation not being allowed for ENUM
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Error: SensitiveData: Field values must be an array of strings/i)).toBeInTheDocument();
    });

    // AND expect an error to be logged to the console
    expect(console.error).toHaveBeenCalledWith(
      new ConfigurationError("SensitiveData: Field values must be an array of strings")
    );
  });

  // GIVEN an invalid configuration with missing required fields
  test("should fail validation when required fields are missing", async () => {
    // GIVEN a config with missing required fields
    const invalidConfig = `
    stringField:
      dataKey: string_field
      type: STRING
      label:
        en-US: String Field
    `;

    // WHEN the config is fetched
    setupAPIServiceSpy(200, invalidConfig, "");

    // THEN the component should show an error about missing required fields
    render(<TestComponent />);
    await waitFor(() => {
      expect(
        screen.getByText(/Error: SensitiveData: Field 'required' is required and must be a boolean/i)
      ).toBeInTheDocument();
    });

    // AND expect an error to be logged to the console
    expect(console.error).toHaveBeenCalledWith(
      new ConfigurationError("SensitiveData: Field 'required' is required and must be a boolean")
    );
  });

  // GIVEN an invalid configuration with wrong ENUM setup
  test("should fail validation when ENUM field has no values", async () => {
    // GIVEN a config with ENUM field missing values
    const invalidConfig = `
    enumField:
      dataKey: enum_field
      type: ENUM
      required: true
      label:
        en-US: Enum Field
    `;

    // WHEN the config is fetched
    setupAPIServiceSpy(200, invalidConfig, "");

    // THEN the component should show an error about missing values
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Error: SensitiveData: Field values must be an array of strings/i)).toBeInTheDocument();
    });

    // AND expect an error to be logged to the console
    expect(console.error).toHaveBeenCalledWith(
      new ConfigurationError("SensitiveData: Field values must be an array of strings")
    );
  });
});
