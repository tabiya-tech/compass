import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";

describe("AuthPersistentStorage class tests", () => {
  beforeEach(() => {
    PersistentStorageService.clear();
  });

  afterAll(() => {
    PersistentStorageService.clear();
  });

  describe("ID token tests", () => {
    test("return correct previously set token ID token", () => {
      // GIVEN The ID token is stored in the session storage
      const givenIDToken = "foo";
      PersistentStorageService.setIDToken(givenIDToken);

      // WHEN The ID token is retrieved
      const IDToken = PersistentStorageService.getIDToken();

      // THEN The ID token should be returned
      expect(IDToken).toEqual(givenIDToken);
    });

    test("return null if ID token is not set", () => {
      // GIVEN The ID token is not stored in the session storage
      // Nothing set

      // WHEN The ID token is retrieved
      const IDToken = PersistentStorageService.getIDToken();

      // THEN null should be returned
      expect(IDToken).toBeNull();
    });

    test("clear ID token", () => {
      // GIVEN The ID token is stored in the session storage
      const givenIDToken = "foo";
      PersistentStorageService.setIDToken(givenIDToken);

      // WHEN The ID token is cleared
      PersistentStorageService.clearIDToken();

      // THEN The ID token should be cleared (null)
      const IDToken = PersistentStorageService.getIDToken();
      expect(IDToken).toBeNull();
    });

    test("set ID token", () => {
      // GIVEN The ID token is not stored in the session storage
      const givenIDToken = "foo";

      // WHEN The ID token is set
      PersistentStorageService.setIDToken(givenIDToken);

      // THEN The ID token should be stored
      const IDToken = PersistentStorageService.getIDToken();
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
    // GIVEN The ID token is stored in the session storage
    const givenID = "foo";
    PersistentStorageService.setIDToken(givenID);

    // WHEN The ID token is cleared
    PersistentStorageService.clear();

    // THEN The ID token should be cleared (null)
    const IDToken = PersistentStorageService.getIDToken();
    expect(IDToken).toBeNull();
  });
});
