import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";
import { Language, UserPreference } from "src/auth/services/UserPreferences/userPreferences.types";

describe("AuthPersistentStorage class tests", () => {
  beforeEach(() => {
    PersistentStorageService.clear();
  });

  afterAll(() => {
    PersistentStorageService.clear();
  });

  describe("Access token tests", () => {
    test("return correct previously set Access token", () => {
      // GIVEN The Access token is stored in the session storage
      const givenIDToken = "foo";
      PersistentStorageService.setAccessToken(givenIDToken);

      // WHEN The Access token is retrieved
      const IDToken = PersistentStorageService.getAccessToken();

      // THEN The Access token should be returned
      expect(IDToken).toEqual(givenIDToken);
    });

    test("return null if Access token is not set", () => {
      // GIVEN The Access token is not stored in the session storage
      // Nothing set

      // WHEN The Access token is retrieved
      const IDToken = PersistentStorageService.getAccessToken();

      // THEN null should be returned
      expect(IDToken).toBeNull();
    });

    test("clear Access token", () => {
      // GIVEN The Access token is stored in the session storage
      const givenIDToken = "foo";
      PersistentStorageService.setAccessToken(givenIDToken);

      // WHEN The Access token is cleared
      PersistentStorageService.clearAccessToken();

      // THEN The Access token should be cleared (null)
      const IDToken = PersistentStorageService.getAccessToken();
      expect(IDToken).toBeNull();
    });

    test("set Access token", () => {
      // GIVEN The Access token is not stored in the session storage
      const givenIDToken = "foo";

      // WHEN The Access token is set
      PersistentStorageService.setAccessToken(givenIDToken);

      // THEN The Access token should be stored
      const IDToken = PersistentStorageService.getAccessToken();
      expect(IDToken).toEqual(givenIDToken);
    });
  });

  describe("user preferences tests", () => {
    test("return correct previously set user preferences", () => {
      // GIVEN The user preferences are stored in the session storage
      const givenUserPreferences: UserPreference = {
        user_id: "foo",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [1, 2, 3],
      };
      PersistentStorageService.setUserPreferences(givenUserPreferences);

      // WHEN The user preferences are retrieved
      const userPreferences = PersistentStorageService.getUserPreferences();

      // THEN The user preferences should be returned
      expect(userPreferences).toEqual(givenUserPreferences);
    });

    test("return null if user preferences are not set", () => {
      // GIVEN The user preferences are not stored in the session storage
      // Nothing set

      // WHEN The user preferences are retrieved
      const userPreferences = PersistentStorageService.getUserPreferences();

      // THEN null should be returned
      expect(userPreferences).toBeNull();
    });

    test("clear user preferences", () => {
      // GIVEN The user preferences are stored in the session storage
      const givenUserPreferences: UserPreference = {
        user_id: "foo",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [1, 2, 3],
      };
      PersistentStorageService.setUserPreferences(givenUserPreferences);

      // WHEN The user preferences are cleared
      PersistentStorageService.clearUserPreferences();

      // THEN The user preferences should be cleared (null)
      const userPreferences = PersistentStorageService.getUserPreferences();
      expect(userPreferences).toBeNull();
    });

    test("set user preferences", () => {
      // GIVEN The user preferences are not stored in the session storage
      const givenUserPreferences: UserPreference = {
        user_id: "foo",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [1, 2, 3],
      };

      // WHEN The user preferences are set
      PersistentStorageService.setUserPreferences(givenUserPreferences);

      // THEN The user preferences should be stored
      const userPreferences = PersistentStorageService.getUserPreferences();
      expect(userPreferences).toEqual(givenUserPreferences);
    });
  });

  test("clear all tokens", () => {
    // GIVEN The Access token is stored in the session storage
    const givenID = "foo";
    PersistentStorageService.setAccessToken(givenID);

    // WHEN The Access token is cleared
    PersistentStorageService.clear();

    // THEN The Access token should be cleared (null)
    const IDToken = PersistentStorageService.getAccessToken();
    expect(IDToken).toBeNull();

    // AND The user preferences should be cleared (null)
    const userPreferences = PersistentStorageService.getUserPreferences();
    expect(userPreferences).toBeNull();
  });
});
