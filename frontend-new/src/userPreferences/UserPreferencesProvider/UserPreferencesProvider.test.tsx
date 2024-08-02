// mute chatty console
import "src/_test_utilities/consoleMock";

import { useContext } from "react";
import {
  UserPreferencesContext,
  userPreferencesContextDefaultValue,
} from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { renderHook } from "src/_test_utilities/test-utils";
import { act } from "@testing-library/react";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";

const renderUserPreferencesContext = () => renderHook(() => useContext(UserPreferencesContext));

describe("UserPreferencesProvider module", () => {
  let userPreferencesService: UserPreferencesService;

  beforeEach(() => {
    userPreferencesService = UserPreferencesService.getInstance();
    jest.useFakeTimers();
  });

  const givenUserPreferences = { user_id: "123", accepted_tc: new Date(), language: Language.en, sessions: [] };

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("Create user preferences functionality", () => {
    test("should call the createUserPreferences service with the correct parameters", async () => {
      // GIVEN: The UserPreferencesProvider is rendered and user preferences context is accessed
      const { result } = renderUserPreferencesContext();
      userPreferencesService.createUserPreferences = jest.fn().mockResolvedValue(givenUserPreferences);

      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // WHEN the createUserPreferences function is called

      const createUserPreferencesSpy = jest.spyOn(userPreferencesService, "createUserPreferences");

      // initially isLoading should be false
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.createUserPreferences(givenUserPreferences, givenSuccessCallback, givenErrorCallback);
      });

      // THEN the user preferences service createUserPreferences function should be called with the correct parameters
      expect(createUserPreferencesSpy).toHaveBeenCalledWith(givenUserPreferences);

      // AND isLoading should be false
      expect(result.current.isLoading).toBe(false);

      // AND the success callback should be called with the new preferences
      expect(givenSuccessCallback).toHaveBeenCalledWith(givenUserPreferences);
    });
    test("should call the error callback on failure", async () => {
      // Simulate failure response
      userPreferencesService.createUserPreferences = jest.fn().mockRejectedValue(new Error("Internal Server Error"));

      // GIVEN: The UserPreferencesProvider is rendered and user preferences context is accessed
      const { result } = renderUserPreferencesContext();

      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // WHEN the createUserPreferences function is called
      const createUserPreferencesSpy = jest.spyOn(userPreferencesService, "createUserPreferences");

      await act(async () => {
        await result.current.createUserPreferences(givenUserPreferences, givenSuccessCallback, givenErrorCallback);
      });

      // THEN the user preferences service createUserPreferences function should be called with the correct parameters
      expect(createUserPreferencesSpy).toHaveBeenCalledWith(givenUserPreferences);

      // AND the error callback should be called
      expect(givenErrorCallback).toHaveBeenCalled();
      // AND the success callback should not be called
      expect(givenSuccessCallback).not.toHaveBeenCalled();
    });
  });

  describe("Get user preferences functionality", () => {
    test("should call the getUserPreferences service with the correct parameters", async () => {
      // GIVEN: The UserPreferencesProvider is rendered and user preferences context is accessed
      const { result } = renderUserPreferencesContext();
      userPreferencesService.getUserPreferences = jest.fn().mockResolvedValue(givenUserPreferences);

      // AND some callback functions
      const givenSuccessCallback = jest.fn().mockImplementation(() => {
        return givenUserPreferences;
      });
      const givenErrorCallback = jest.fn();

      // WHEN the getUserPreferences function is called
      const givenUserId = "user123";

      const getUserPreferencesSpy = jest.spyOn(userPreferencesService, "getUserPreferences");

      // initially isLoading should be false
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.getUserPreferences(givenUserId, givenSuccessCallback, givenErrorCallback);
      });

      // THEN the user preferences service getUserPreferences function should be called with the correct parameters
      expect(getUserPreferencesSpy).toHaveBeenCalledWith(givenUserId);

      // AND isLoading should be false
      expect(result.current.isLoading).toBe(false);

      // AND the success callback should be called with the preferences
      expect(givenSuccessCallback).toHaveBeenCalledWith(givenUserPreferences);
    });
    test("should call the error callback on failure", async () => {
      // Simulate failure response
      userPreferencesService.getUserPreferences = jest.fn().mockRejectedValue(new Error("Internal Server Error"));

      // GIVEN: The UserPreferencesProvider is rendered and user preferences context is accessed
      const { result } = renderUserPreferencesContext();

      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // WHEN the getUserPreferences function is called
      const givenUserId = "user123";

      const getUserPreferencesSpy = jest.spyOn(userPreferencesService, "getUserPreferences");

      await act(async () => {
        await result.current.getUserPreferences(givenUserId, givenSuccessCallback, givenErrorCallback);
      });

      // THEN the user preferences service getUserPreferences function should be called with the correct parameters
      expect(getUserPreferencesSpy).toHaveBeenCalledWith(givenUserId);

      // AND the error callback should be called
      expect(givenErrorCallback).toHaveBeenCalled();
      // AND the success callback should not be called
      expect(givenSuccessCallback).not.toHaveBeenCalled();
    });
  });

  describe("userPreferencesContextDefaultValue", () => {
    test("should return the default values", () => {
      // GIVEN: Default values for the UserPreferencesContext
      const givenUserPreferencesContextDefaultValue = userPreferencesContextDefaultValue;

      // THEN: The default values should be as expected
      expect(givenUserPreferencesContextDefaultValue.userPreferences).toBeNull();
      expect(givenUserPreferencesContextDefaultValue.isLoading).toBe(false);
    });
  });
});
