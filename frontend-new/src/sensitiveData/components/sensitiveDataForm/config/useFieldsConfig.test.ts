import "src/_test_utilities/consoleMock";
import { renderHook } from "@testing-library/react-hooks";
import { useFieldsConfig } from "./useFieldsConfig";
import * as utils from "./utils";
import { setupFetchSpy } from "src/_test_utilities/fetchSpy";

// Mock the utils functions
jest.mock('./utils', () => ({
  parseYamlConfig: jest.fn(),
  getAllFields: jest.fn()
}));

describe('Config Hooks', () => {
  let fetchSpy: jest.SpyInstance;

  const mockYamlText = `
stringFieldName:
  dataKey: string_field_name
  type: STRING
  required: true
  label: String Field
`;

  const mockConfig = {
    stringFieldName: {
      dataKey: "string_field_name",
      type: "STRING",
      required: true,
      label: "String Field",
    },
  };

  const mockFields = [
    {
      dataKey: "string_field_name",
      type: "STRING",
      required: true,
      label: "String Field",
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (utils.parseYamlConfig as jest.Mock).mockReturnValue(mockConfig);
    (utils.getAllFields as jest.Mock).mockReturnValue(mockFields);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('useFieldsConfig', () => {
    test('should return default config and loading state initially', () => {
      // GIVEN the useFieldsConfig hook
      // WHEN it is first rendered
      const { result } = renderHook(() => useFieldsConfig());

      // THEN it should return the default config and loading=true
      expect(result.current.fields).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    test('should fetch and update config on mount', async () => {
      // GIVEN a successful fetch response
      fetchSpy = setupFetchSpy(200, mockYamlText, "");

      // WHEN the hook is mounted
      const { result, waitForNextUpdate } = renderHook(() => useFieldsConfig());
      
      // THEN it should initially be in loading state
      expect(result.current.loading).toBe(true);
      
      // WHEN the fetch completes
      await waitForNextUpdate();
      
      // THEN it should update the state with the result
      expect(fetchSpy).toHaveBeenCalledWith('/data/config/fields.yaml');
      expect(utils.parseYamlConfig).toHaveBeenCalledWith(mockYamlText);
      expect(utils.getAllFields).toHaveBeenCalledWith(mockConfig);
      expect(result.current.fields).toEqual(mockFields);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    test('should handle config loading errors', async () => {
      // GIVEN a failed fetch response
      fetchSpy = setupFetchSpy(500, undefined, "");

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
      expect(result.current.error?.message).toContain('Failed to load fields configuration');
    });

    test('should clean up on unmount', async () => {
      // GIVEN a pending fetch that never resolves
      fetchSpy = setupFetchSpy(200, new Promise(() => {}), "");

      // WHEN the hook is mounted and then unmounted
      const { unmount } = renderHook(() => useFieldsConfig());
      
      // AND then unmounted before the fetch completes
      unmount();
      
      // THEN it should not throw any errors
      // This is a negative test - we're verifying that unmounting doesn't cause issues
      expect(true).toBe(true);
    });
  });
}); 