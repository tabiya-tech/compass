// mock the console logs
import "src/_test_utilities/consoleMock";

import LocaleSyncService from "./LocaleSyncService";
import { Locale, FALL_BACK_LOCALE, SupportedLocales } from "src/i18n/constants";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import {
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import i18n from "src/i18n/i18n";

// Mock UserPreferencesService
jest.mock("src/userPreferences/UserPreferencesService/userPreferences.service");

function getMockUserPreference(overrides: Partial<UserPreference> = {}): UserPreference {
  return {
    user_id: "test-user-id",
    language: Locale.EN_GB,
    sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
    has_sensitive_personal_data: true,
    accepted_tc: new Date(),
    sessions: [1, 2, 3],
    user_feedback_answered_questions: {},
    experiments: {},
    ...overrides,
  };
}

describe("LocaleSyncService", () => {
  let service: LocaleSyncService;
  let mockUpdateUserPreferences: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset i18n mock state
    (i18n as any).language = "en-GB";

    // Clear the UserPreferencesStateService state
    UserPreferencesStateService.getInstance().clearUserPreferences();

    // Setup UserPreferencesService mock
    mockUpdateUserPreferences = jest.fn().mockResolvedValue(getMockUserPreference());
    (UserPreferencesService.getInstance as jest.Mock).mockReturnValue({
      updateUserPreferences: mockUpdateUserPreferences,
    });

    // Get fresh instance reference (singleton persists, but we reset mocks)
    service = LocaleSyncService.getInstance();
  });

  describe("getInstance", () => {
    test("should return a singleton instance", () => {
      // WHEN getInstance is called multiple times
      const firstInstance = LocaleSyncService.getInstance();
      const secondInstance = LocaleSyncService.getInstance();

      // THEN both should be the same instance
      expect(firstInstance).toBe(secondInstance);
    });
  });

  describe("syncLocaleToBackend", () => {
    test("should skip sync when user is not authenticated", async () => {
      // GIVEN the user is not authenticated (no preferences)
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toBeNull();

      // WHEN syncLocaleToBackend is called
      await service.syncLocaleToBackend(Locale.ES_ES);

      // THEN no API call should be made
      expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
    });

    test("should sync locale to backend when user is authenticated", async () => {
      // GIVEN the user is authenticated
      const mockPrefs = getMockUserPreference();
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      const updatedPrefs = getMockUserPreference({ language: Locale.ES_ES });
      mockUpdateUserPreferences.mockResolvedValue(updatedPrefs);

      // WHEN syncLocaleToBackend is called
      await service.syncLocaleToBackend(Locale.ES_ES);

      // THEN the API should be called with the correct parameters
      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        user_id: mockPrefs.user_id,
        language: Locale.ES_ES,
      });
    });

    test("should update local state with response from backend", async () => {
      // GIVEN the user is authenticated
      const mockPrefs = getMockUserPreference();
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      const updatedPrefs = getMockUserPreference({ language: Locale.ES_ES });
      mockUpdateUserPreferences.mockResolvedValue(updatedPrefs);

      // WHEN syncLocaleToBackend is called
      await service.syncLocaleToBackend(Locale.ES_ES);

      // THEN the local state should be updated
      const currentPrefs = UserPreferencesStateService.getInstance().getUserPreferences();
      expect(currentPrefs?.language).toBe(Locale.ES_ES);
    });

    test("should handle API errors gracefully without throwing", async () => {
      // GIVEN the user is authenticated
      const mockPrefs = getMockUserPreference();
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      // AND the API will fail
      const apiError = new Error("API error");
      mockUpdateUserPreferences.mockRejectedValue(apiError);

      // WHEN syncLocaleToBackend is called
      // THEN it should not throw
      await expect(service.syncLocaleToBackend(Locale.ES_ES)).resolves.not.toThrow();

      // AND the error should be logged (console is mocked)
      expect(console.error).toHaveBeenCalled();
    });

    describe("race condition handling", () => {
      test("should queue subsequent requests while one is pending", async () => {
        // GIVEN the user is authenticated
        const mockPrefs = getMockUserPreference();
        UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

        // AND the API has a delay
        let resolveFirst: () => void;
        const firstCallPromise = new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });

        let callCount = 0;
        mockUpdateUserPreferences.mockImplementation(async (params: { language: Locale }) => {
          callCount++;
          if (callCount === 1) {
            await firstCallPromise;
          }
          return getMockUserPreference({ language: params.language });
        });

        // WHEN multiple sync calls are made rapidly
        const promise1 = service.syncLocaleToBackend(Locale.ES_ES);
        const promise2 = service.syncLocaleToBackend(Locale.EN_US);
        const promise3 = service.syncLocaleToBackend(Locale.ES_AR);

        // Resolve the first call
        resolveFirst!();

        await Promise.all([promise1, promise2, promise3]);

        // THEN only 2 API calls should be made (first + last queued)
        // The intermediate locale (EN_US) should be skipped
        expect(mockUpdateUserPreferences).toHaveBeenCalledTimes(2);
        expect(mockUpdateUserPreferences).toHaveBeenNthCalledWith(1, {
          user_id: mockPrefs.user_id,
          language: Locale.ES_ES,
        });
        expect(mockUpdateUserPreferences).toHaveBeenNthCalledWith(2, {
          user_id: mockPrefs.user_id,
          language: Locale.ES_AR,
        });
      });
    });
  });

  describe("syncOnLogin", () => {
    test("should not sync when locales match", async () => {
      // GIVEN the user is authenticated
      const mockPrefs = getMockUserPreference({ language: Locale.EN_GB });
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      // WHEN syncOnLogin is called with matching locales
      await service.syncOnLogin(Locale.EN_GB, Locale.EN_GB);

      // THEN no API call should be made
      expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
    });

    test("should sync to backend when locales differ", async () => {
      // GIVEN the user is authenticated with EN_GB locale
      const mockPrefs = getMockUserPreference({ language: Locale.EN_GB });
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      mockUpdateUserPreferences.mockResolvedValue(getMockUserPreference({ language: Locale.ES_ES }));

      // WHEN syncOnLogin is called with different locales
      await service.syncOnLogin(Locale.EN_GB, Locale.ES_ES);

      // THEN the API should be called with the frontend locale
      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        user_id: mockPrefs.user_id,
        language: Locale.ES_ES,
      });
    });

    test("should handle backend locale as string", async () => {
      // GIVEN the user is authenticated
      const mockPrefs = getMockUserPreference({ language: Locale.EN_GB });
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      mockUpdateUserPreferences.mockResolvedValue(getMockUserPreference({ language: Locale.ES_ES }));

      // WHEN syncOnLogin is called with backend locale as string
      await service.syncOnLogin("en-GB", Locale.ES_ES);

      // THEN the API should be called
      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        user_id: mockPrefs.user_id,
        language: Locale.ES_ES,
      });
    });
  });

  describe("applyBackendLocale", () => {
    test("should change i18n language when backend locale differs from current", async () => {
      // GIVEN the current i18n language is EN_GB
      (i18n as any).language = Locale.EN_GB;

      // WHEN applyBackendLocale is called with a different locale
      await service.applyBackendLocale(Locale.ES_ES);

      // THEN i18n.changeLanguage should be called
      expect(i18n.changeLanguage).toHaveBeenCalledWith(Locale.ES_ES);
    });

    test("should not change i18n language when backend locale matches current", async () => {
      // GIVEN the current i18n language is EN_GB
      (i18n as any).language = Locale.EN_GB;

      // WHEN applyBackendLocale is called with the same locale
      await service.applyBackendLocale(Locale.EN_GB);

      // THEN i18n.changeLanguage should not be called
      expect(i18n.changeLanguage).not.toHaveBeenCalled();
    });

    test("should fall back to FALL_BACK_LOCALE when backend locale is not supported", async () => {
      // GIVEN the current i18n language is EN_GB
      (i18n as any).language = Locale.EN_GB;

      // WHEN applyBackendLocale is called with an unsupported locale
      await service.applyBackendLocale("invalid-locale");

      // THEN i18n.changeLanguage should be called with the fallback locale
      expect(i18n.changeLanguage).toHaveBeenCalledWith(FALL_BACK_LOCALE);

      // AND an warning should be logged
      expect(console.warn).toHaveBeenCalled();
    });

    test("should validate all supported locales correctly", async () => {
      // Test each supported locale to ensure they're all accepted
      for (const locale of SupportedLocales) {
        jest.clearAllMocks();
        (i18n as any).language = "different-locale";

        // WHEN applyBackendLocale is called with a supported locale
        await service.applyBackendLocale(locale);

        // THEN i18n.changeLanguage should be called with that locale
        expect(i18n.changeLanguage).toHaveBeenCalledWith(locale);

        // AND no error should be logged
        expect(console.error).not.toHaveBeenCalled();
      }
    });
  });

  describe("waitForPendingSync", () => {
    test("should resolve immediately if no sync is pending", async () => {
      // WHEN waitForPendingSync is called
      const promise = service.waitForPendingSync();

      // THEN it should resolve
      await expect(promise).resolves.not.toThrow();
    });

    test("should wait for pending sync to complete", async () => {
      // GIVEN the user is authenticated
      const mockPrefs = getMockUserPreference();
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      // AND a sync is pending (delayed)
      let resolveSync: () => void;
      const syncPromise = new Promise<void>((resolve) => {
        resolveSync = resolve;
      });

      mockUpdateUserPreferences.mockImplementation(async () => {
        await syncPromise;
        return getMockUserPreference();
      });

      // Start sync
      const syncCall = service.syncLocaleToBackend(Locale.ES_ES);

      // WHEN waitForPendingSync is called
      let waitResolved = false;
      const waitPromise = service.waitForPendingSync().then(() => {
        waitResolved = true;
      });

      // THEN it should not resolve yet
      await new Promise((r) => setTimeout(r, 0));
      expect(waitResolved).toBe(false);

      // WHEN sync completes
      resolveSync!();
      await syncCall;

      // THEN waitForPendingSync should resolve
      await waitPromise;
      expect(waitResolved).toBe(true);
    });

    test("should wait for queued sync to complete", async () => {
      // GIVEN the user is authenticated
      const mockPrefs = getMockUserPreference();
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      // AND a sync is pending (delayed)
      let resolveFirstSync: () => void;
      const firstSyncPromise = new Promise<void>((resolve) => {
        resolveFirstSync = resolve;
      });

      let resolveSecondSync: () => void;
      const secondSyncPromise = new Promise<void>((resolve) => {
        resolveSecondSync = resolve;
      });

      let callCount = 0;
      mockUpdateUserPreferences.mockImplementation(async (params) => {
        callCount++;
        if (callCount === 1) {
          await firstSyncPromise;
        } else if (callCount === 2) {
          await secondSyncPromise;
        }
        return getMockUserPreference({ language: params.language });
      });

      // Start first sync
      const syncCall1 = service.syncLocaleToBackend(Locale.ES_ES);

      // Queue second sync
      const syncCall2 = service.syncLocaleToBackend(Locale.ES_AR);

      // WHEN waitForPendingSync is called
      let waitResolved = false;
      const waitPromise = service.waitForPendingSync().then(() => {
        waitResolved = true;
      });

      // Resolve first sync
      resolveFirstSync!();

      // Wait a bit for microtasks
      await new Promise((r) => setTimeout(r, 0));

      // Resolve second sync
      resolveSecondSync!();
      await Promise.all([syncCall1, syncCall2]);

      // THEN waitForPendingSync should resolve
      await waitPromise;
      expect(waitResolved).toBe(true);
      expect(callCount).toBe(2);
    });
  });

  describe("isAuthenticated", () => {
    test("should return false when user preferences are not set", () => {
      // GIVEN no user preferences are set
      UserPreferencesStateService.getInstance().clearUserPreferences();

      // WHEN isAuthenticated is called
      const result = service.isAuthenticated();

      // THEN it should return false
      expect(result).toBe(false);
    });

    test("should return true when user preferences are set", () => {
      // GIVEN user preferences are set
      const mockPrefs = getMockUserPreference();
      UserPreferencesStateService.getInstance().setUserPreferences(mockPrefs);

      // WHEN isAuthenticated is called
      const result = service.isAuthenticated();

      // THEN it should return true
      expect(result).toBe(true);
    });
  });
});
