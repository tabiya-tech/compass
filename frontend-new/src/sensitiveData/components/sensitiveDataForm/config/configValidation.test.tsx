import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useFieldsConfig } from './useFieldsConfig';
import { setupFetchSpy } from 'src/_test_utilities/fetchSpy';

// Mock component to test the hook
const TestComponent = () => {
  const { fields, loading, error } = useFieldsConfig();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>Fields loaded: {fields.length}</div>;
};

describe('Fields Configuration Validation', () => {
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // GIVEN a valid configuration
  test('should load and validate a correct configuration', async () => {
    // GIVEN the example config from fields.example.yaml
    const validConfig = `
stringFieldName:
  dataKey: string_field_name
  type: STRING
  required: true
  label: String Field
  validation:
    pattern: ^[\\p{L}]{1,48}$
    errorMessage: String Field should contain only letters
`;
    
    // WHEN the config is fetched
    fetchSpy = setupFetchSpy(200, validConfig, "");

    // THEN the component should render successfully
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Fields loaded:/)).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with duplicate dataKeys
  test('should fail validation when dataKeys are not unique', async () => {
    // GIVEN a config with duplicate dataKeys
    const invalidConfig = `
field1:
  dataKey: same_key
  type: STRING
  required: true
  label: Field 1
field2:
  dataKey: same_key
  type: STRING
  required: true
  label: Field 2
`;

    // WHEN the config is fetched
    fetchSpy = setupFetchSpy(200, invalidConfig, "");

    // THEN the component should show an error about duplicate keys
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Configuration validation failed: Duplicate dataKey/i)).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with wrong field types
  test('should fail validation when field types are incorrect', async () => {
    // GIVEN a config with incorrect field types
    const invalidConfig = `
enumField:
  dataKey: enum_field
  type: ENUM
  required: true
  label: Enum Field
  validation:
    pattern: .*
    errorMessage: This should not be here
`;

    // WHEN the config is fetched
    fetchSpy = setupFetchSpy(200, invalidConfig, "");

    // THEN the component should show an error about validation not being allowed for ENUM
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Configuration validation failed: Field "enumField" of type ENUM must have non-empty values array, Field "enumField" of type ENUM should not have validation property/i)).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with missing required fields
  test('should fail validation when required fields are missing', async () => {
    // GIVEN a config with missing required fields
    const invalidConfig = `
stringField:
  dataKey: string_field
  type: STRING
`;

    // WHEN the config is fetched
    fetchSpy = setupFetchSpy(200, invalidConfig, "");

    // THEN the component should show an error about missing required fields
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Invalid configuration/i)).toBeInTheDocument();
    });
  });

  // GIVEN an invalid configuration with wrong ENUM setup
  test('should fail validation when ENUM field has no values', async () => {
    // GIVEN a config with ENUM field missing values
    const invalidConfig = `
enumField:
  dataKey: enum_field
  type: ENUM
  required: true
  label: Enum Field
`;

    // WHEN the config is fetched
    fetchSpy = setupFetchSpy(200, invalidConfig, "");

    // THEN the component should show an error about missing values
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Configuration validation failed: Field "enumField" of type ENUM must have non-empty values array/i)).toBeInTheDocument();
    });
  });
}); 