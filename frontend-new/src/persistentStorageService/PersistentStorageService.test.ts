import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";

describe("AuthPersistentStorage class tests", () => {
  beforeEach(() => {
    PersistentStorageService.clear();
  });

  afterAll(() => {
    PersistentStorageService.clear();
  });

  describe("Access token tests", () => {
    test("return correct previously set token Access token", () => {
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

  describe("chat session Id tests", () => {
    test("return correct previously set chat session Id", () => {
      // GIVEN The chat session Id is stored in the session storage
      const givenChatSessionId = "foo";
      PersistentStorageService.setChatSessionID(givenChatSessionId);

      // WHEN The chat session Id is retrieved
      const chatSessionId = PersistentStorageService.getChatSessionID();

      // THEN The chat session Id should be returned
      expect(chatSessionId).toEqual(givenChatSessionId);
    });

    test("return null if chat session Id is not set", () => {
      // GIVEN The chat session Id is not stored in the session storage
      // Nothing set

      // WHEN The chat session Id is retrieved
      const chatSessionId = PersistentStorageService.getChatSessionID();

      // THEN null should be returned
      expect(chatSessionId).toBeNull();
    });

    test("clear chat session Id", () => {
      // GIVEN The chat session Id is stored in the session storage
      const givenChatSessionId = "foo";
      PersistentStorageService.setChatSessionID(givenChatSessionId);

      // WHEN The chat session Id is cleared
      PersistentStorageService.clearChatSessionID();

      // THEN The chat session Id should be cleared (null)
      const chatSessionId = PersistentStorageService.getChatSessionID();
      expect(chatSessionId).toBeNull();
    });

    test("set chat session Id", () => {
      // GIVEN The chat session Id is not stored in the session storage
      const givenChatSessionId = "foo";

      // WHEN The chat session Id is set
      PersistentStorageService.setChatSessionID(givenChatSessionId);

      // THEN The chat session Id should be stored
      const chatSessionId = PersistentStorageService.getChatSessionID();
      expect(chatSessionId).toEqual(givenChatSessionId);
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
  });
});
