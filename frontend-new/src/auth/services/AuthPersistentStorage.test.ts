import { AuthPersistentStorage } from "src/auth/services/AuthPersistentStorage";

describe("AuthPersistentStorage class tests", () => {
  beforeEach(() => {
    AuthPersistentStorage.clear();
  });

  afterAll(() => {
    AuthPersistentStorage.clear();
  });

  describe("Refresh token tests", () => {
    test("return correct previously set token refresh token", () => {
      // GIVEN The refresh token is stored in the session storage
      const givenRefreshToken = "foo";
      AuthPersistentStorage.setRefreshToken(givenRefreshToken);

      // WHEN The refresh token is retrieved
      const refreshToken = AuthPersistentStorage.getRefreshToken();

      // THEN The refresh token should be returned
      expect(refreshToken).toEqual(givenRefreshToken);
    });

    test("return null if refresh token is not set", () => {
      // GIVEN The refresh token is not stored in the session storage
      // Nothing set

      // WHEN The refresh token is retrieved
      const refreshToken = AuthPersistentStorage.getRefreshToken();

      // THEN null should be returned
      expect(refreshToken).toBeNull();
    });

    test("clear refresh token", () => {
      // GIVEN The refresh token is stored in the session storage
      const givenRefresh = "foo";
      AuthPersistentStorage.setRefreshToken(givenRefresh);

      // WHEN The refresh token is cleared
      AuthPersistentStorage.clearRefreshToken();

      // THEN The refresh token should be cleared (null)
      const refreshToken = AuthPersistentStorage.getRefreshToken();
      expect(refreshToken).toBeNull();
    });

    test("set refresh token", () => {
      // GIVEN The refresh token is not stored in the session storage
      const givenRefresh = "foo";

      // WHEN The refresh token is set
      AuthPersistentStorage.setRefreshToken(givenRefresh);

      // THEN The refresh token should be stored
      const refreshToken = AuthPersistentStorage.getRefreshToken();
      expect(refreshToken).toEqual(givenRefresh);
    });
  });

  describe("Auth token tests", () => {
    test("return correct previously set token auth token", () => {
      // GIVEN The auth token is stored in the session storage
      const givenIDToken = "foo";
      AuthPersistentStorage.setIDToken(givenIDToken);

      // WHEN The auth token is retrieved
      const authToken = AuthPersistentStorage.getIDToken();

      // THEN The auth token should be returned
      expect(authToken).toEqual(givenIDToken);
    });

    test("return null if auth token is not set", () => {
      // GIVEN The auth token is not stored in the session storage
      // Nothing set

      // WHEN The auth token is retrieved
      const authToken = AuthPersistentStorage.getIDToken();

      // THEN null should be returned
      expect(authToken).toBeNull();
    });

    test("clear auth token", () => {
      // GIVEN The auth token is stored in the session storage
      const givenIDToken = "foo";
      AuthPersistentStorage.setIDToken(givenIDToken);

      // WHEN The auth token is cleared
      AuthPersistentStorage.clearIDToken();

      // THEN The auth token should be cleared (null)
      const authToken = AuthPersistentStorage.getIDToken();
      expect(authToken).toBeNull();
    });

    test("set auth token", () => {
      // GIVEN The auth token is not stored in the session storage
      const givenIDToken = "foo";

      // WHEN The auth token is set
      AuthPersistentStorage.setIDToken(givenIDToken);

      // THEN The auth token should be stored
      const authToken = AuthPersistentStorage.getIDToken();
      expect(authToken).toEqual(givenIDToken);
    });
  });

  test("clear all tokens", () => {
    // GIVEN The refresh token is stored in the session storage
    const givenRefresh = "foo";
    AuthPersistentStorage.setRefreshToken(givenRefresh);

    // WHEN The refresh token is cleared
    AuthPersistentStorage.clear();

    // THEN The refresh token should be cleared (null)
    const refreshToken = AuthPersistentStorage.getRefreshToken();
    expect(refreshToken).toBeNull();
  });
});
