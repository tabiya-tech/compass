// silence chatty console
import "src/_test_utilities/consoleMock";

import { issueNewSession } from "src/chat/issueNewSession";
import { Language, SensitivePersonalDataRequirement, UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { SessionError } from "src/error/commonErrors";

describe("issueNewSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should return new session id when session is created successfully", async () => {
    // GIVEN a user ID
    const givenUserId = "user123";
    // AND a new session ID
    const givenNewSessionId = 123;
    // AND the user preferences service instance will return a new session for the given user ID and new session ID
    const givenUserPreferences: UserPreference = {
      user_id: givenUserId,
      language: Language.en,
      accepted_tc : new Date(),
      sessions: [givenNewSessionId],
      sessions_with_feedback: [givenNewSessionId],
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      has_sensitive_personal_data: false,
    };
    const givenUserPreferencesServiceInstance = UserPreferencesService.getInstance();
    jest.spyOn(givenUserPreferencesServiceInstance, "getNewSession").mockResolvedValueOnce(givenUserPreferences);


    // WHEN the function is called
    const actualNewSessionId = await issueNewSession(givenUserId);

    // THEN expect the user preferences service instance to have been called with the given user ID
    expect(givenUserPreferencesServiceInstance.getNewSession).toHaveBeenCalledWith(givenUserId);
    // AND the new session ID is returned
    expect(actualNewSessionId).toBe(givenNewSessionId);
    // AND the UserPreferencesStateService is queried for the active session ID
    expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenUserPreferences);

    // AND no errors are logged
    expect(console.error).not.toHaveBeenCalled();
    // AND no warnings are logged
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should return null and log error when session creation fails", async () => {
    // GIVEN some user preferences
    const givenUserPreferences: UserPreference = {
      user_id: "foo",
      language: Language.en,
      accepted_tc : new Date(),
      sessions: [123],
      sessions_with_feedback: [123],
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      has_sensitive_personal_data: false,
    };
    // AND the user preferences state service has the given user preferences
    const givenUserPrefStateServiceInstance = UserPreferencesStateService.getInstance();
    givenUserPrefStateServiceInstance.setUserPreferences(givenUserPreferences);

    // AND some user ID
    const givenUserId = "bar";
    // AND the user preferences service instance will throw an error when creating a new session for the given user ID
    const givenError = new Error("Failed to create new session");
    const givenUserPreferencesServiceInstance = UserPreferencesService.getInstance();
    jest.spyOn(givenUserPreferencesServiceInstance, "getNewSession").mockRejectedValueOnce(givenError);

    // WHEN the function is called
    const actualNewSessionId = await issueNewSession(givenUserId);

    // THEN null is returned
    expect(actualNewSessionId).toBeNull();

    // AND the error is logged
    expect(console.error).toHaveBeenCalledWith(new SessionError("Failed to create new session", givenError));

    // AND the UserPreferencesStateService remains unchanged
    expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenUserPreferences);
  });
});