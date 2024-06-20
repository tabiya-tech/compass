import { AuthPersistentStorage } from "src/auth/services/AuthPersistentStorage/AuthPersistentStorage";

describe("AuthPersistentStorage class tests", () => {
  beforeEach(() => {
    AuthPersistentStorage.clear();
  });

  afterAll(() => {
    AuthPersistentStorage.clear();
  });

  describe("ID token tests", () => {
    test("return correct previously set token ID token", () => {
      // GIVEN The ID token is stored in the session storage
      const givenIDToken = "foo";
      AuthPersistentStorage.setIDToken(givenIDToken);

      // WHEN The ID token is retrieved
      const IDToken = AuthPersistentStorage.getIDToken();

      // THEN The ID token should be returned
      expect(IDToken).toEqual(givenIDToken);
    });

    test("return null if ID token is not set", () => {
      // GIVEN The ID token is not stored in the session storage
      // Nothing set

      // WHEN The ID token is retrieved
      const IDToken = AuthPersistentStorage.getIDToken();

      // THEN null should be returned
      expect(IDToken).toBeNull();
    });

    test("clear ID token", () => {
      // GIVEN The ID token is stored in the session storage
      const givenIDToken = "foo";
      AuthPersistentStorage.setIDToken(givenIDToken);

      // WHEN The ID token is cleared
      AuthPersistentStorage.clearIDToken();

      // THEN The ID token should be cleared (null)
      const IDToken = AuthPersistentStorage.getIDToken();
      expect(IDToken).toBeNull();
    });

    test("set ID token", () => {
      // GIVEN The ID token is not stored in the session storage
      const givenIDToken = "foo";

      // WHEN The ID token is set
      AuthPersistentStorage.setIDToken(givenIDToken);

      // THEN The ID token should be stored
      const IDToken = AuthPersistentStorage.getIDToken();
      expect(IDToken).toEqual(givenIDToken);
    });
  });

  test("clear all tokens", () => {
    // GIVEN The ID token is stored in the session storage
    const givenID = "foo";
    AuthPersistentStorage.setIDToken(givenID);

    // WHEN The ID token is cleared
    AuthPersistentStorage.clear();

    // THEN The ID token should be cleared (null)
    const IDToken = AuthPersistentStorage.getIDToken();
    expect(IDToken).toBeNull();
  });
});
