import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SessionError } from "src/error/commonErrors";

/**
 * Issue a new session for the user and set the user preferences in the user preferences state service.
 * @param user_id
 * @returns {Promise<number | null>} The session id of the new session, or null if the session could not be created
 */
export const issueNewSession = async (user_id: string): Promise<number | null> => {
  try {
    // If there is no session id, then create a new session
    let user_preferences = await UserPreferencesService.getInstance().getNewSession(user_id);
    // Set the retrieved user preferences in the user preferences state service
    const userPreferencesStateService = UserPreferencesStateService.getInstance();
    userPreferencesStateService.setUserPreferences(user_preferences);
    return userPreferencesStateService.getActiveSessionId();
  } catch (e) {
    console.error(new SessionError("Failed to create new session", e as Error));
  }
  return null;
};