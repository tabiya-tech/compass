import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SessionError } from "src/error/commonErrors";

/**
 * Ensures the user has a session. Fetches user preferences (backend creates a session if missing),
 * updates state, and returns the active session id.
 * @param user_id
 * @returns The session id, or null if fetch failed
 */
export const ensureSessionForUser = async (user_id: string): Promise<number | null> => {
  try {
    // Chat init can race the registration POST during first sign-up; retry the GET so a
    // transient 404 doesn't lock the chat with the SOMETHING_WENT_WRONG fallback.
    const user_preferences = await UserPreferencesService.getInstance().getUserPreferences(user_id, {
      retryOn404: true,
    });
    UserPreferencesStateService.getInstance().setUserPreferences(user_preferences);
    return UserPreferencesStateService.getInstance().getActiveSessionId();
  } catch (e) {
    console.error(new SessionError("Failed to ensure session for user", e));
  }
  return null;
};
