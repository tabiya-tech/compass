// silence chatty console
import "src/_test_utilities/consoleMock";

import { ensureSessionForUser } from "src/chat/ensureSession";
import {
  Language,
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { SessionError } from "src/error/commonErrors";

describe("ensureSessionForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return session id and update state when preferences are fetched successfully", async () => {
    const givenUserId = "user123";
    const givenNewSessionId = 123;
    const givenUserPreferences: UserPreference = {
      user_id: givenUserId,
      language: Language.en,
      accepted_tc: new Date(),
      sessions: [givenNewSessionId],
      user_feedback_answered_questions: {},
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      has_sensitive_personal_data: false,
      experiments: {},
    };
    const givenUserPreferencesServiceInstance = UserPreferencesService.getInstance();
    jest.spyOn(givenUserPreferencesServiceInstance, "getUserPreferences").mockResolvedValueOnce(givenUserPreferences);

    const actualSessionId = await ensureSessionForUser(givenUserId);

    expect(givenUserPreferencesServiceInstance.getUserPreferences).toHaveBeenCalledWith(givenUserId, {
      retryOn404: true,
    });
    expect(actualSessionId).toBe(givenNewSessionId);
    expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenUserPreferences);
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should return null and log error when fetch fails", async () => {
    const givenUserPreferences: UserPreference = {
      user_id: "foo",
      language: Language.en,
      accepted_tc: new Date(),
      sessions: [123],
      user_feedback_answered_questions: {},
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      has_sensitive_personal_data: false,
      experiments: {},
    };
    const givenUserPrefStateServiceInstance = UserPreferencesStateService.getInstance();
    givenUserPrefStateServiceInstance.setUserPreferences(givenUserPreferences);

    const givenUserId = "bar";
    const givenError = new Error("Failed to fetch preferences");
    const givenUserPreferencesServiceInstance = UserPreferencesService.getInstance();
    jest.spyOn(givenUserPreferencesServiceInstance, "getUserPreferences").mockRejectedValueOnce(givenError);

    const actualSessionId = await ensureSessionForUser(givenUserId);

    expect(actualSessionId).toBeNull();
    expect(console.error).toHaveBeenCalledWith(new SessionError("Failed to ensure session for user", givenError));
    expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenUserPreferences);
  });
});
