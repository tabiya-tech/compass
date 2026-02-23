import { Locale, SupportedLocales, FALL_BACK_LOCALE } from "src/i18n/constants";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import i18n from "src/i18n/i18n";

/**
 * LocaleSyncService is responsible for synchronizing the frontend i18n locale
 * with the backend user preferences.
 *
 * Responsibilities:
 * - Sync locale changes to backend when a user changes language in UI
 * - Apply backend locale to frontend on page refresh (for authenticated users)
 * - Sync locale to backend on login if frontend and backend differ
 * - Handle race conditions when rapid locale changes occur
 *
 * This service is a singleton to ensure consistent state management across the app.
 */
export default class LocaleSyncService {
  private static instance: LocaleSyncService;
  private pendingSync: Promise<void> | null = null;
  private queuedLocale: Locale | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of LocaleSyncService.
   * @returns {LocaleSyncService} The singleton instance.
   */
  public static getInstance(): LocaleSyncService {
    if (!LocaleSyncService.instance) {
      LocaleSyncService.instance = new LocaleSyncService();
    }
    return LocaleSyncService.instance;
  }

  /**
   * Sync the current locale to the backend.
   * Handles race conditions by tracking pending requests and queuing the latest locale.
   *
   * @param {Locale} locale - The locale to sync to backend.
   * @returns {Promise<void>}
   */
  public async syncLocaleToBackend(locale: Locale): Promise<void> {
    // If there's already a pending sync, queue this locale and wait
    if (this.pendingSync) {
      this.queuedLocale = locale;
      await this.pendingSync;
      // After pending completing, if this was the queued locale, process it
      if (this.queuedLocale === locale) {
        this.queuedLocale = null;
        return this.executeSyncToBackend(locale);
      }
      // Otherwise, a newer locale was queued, so skip this one
      return;
    }

    return this.executeSyncToBackend(locale);
  }

  /**
   * Execute the actual sync to backend.
   * @param {Locale} locale - The locale to sync.
   * @returns {Promise<void>}
   */
  private async executeSyncToBackend(locale: Locale): Promise<void> {
    const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

    // Guard: Don't sync if not authenticated
    if (!userPreferences) {
      console.debug("LocaleSyncService: Skipping sync, user not authenticated");
      return;
    }

    this.pendingSync = this.performBackendUpdate(userPreferences.user_id, locale);

    try {
      await this.pendingSync;
    } finally {
      this.pendingSync = null;
    }
  }

  /**
   * Perform the actual PATCH request to update locale in backend.
   * @param {string} userId - The user ID.
   * @param {Locale} locale - The locale to update.
   * @returns {Promise<void>}
   */
  private async performBackendUpdate(userId: string, locale: Locale): Promise<void> {
    try {
      const updatedPreferences = await UserPreferencesService.getInstance().updateUserPreferences({
        user_id: userId,
        language: locale,
      });

      // Update local state with the response
      UserPreferencesStateService.getInstance().setUserPreferences(updatedPreferences);
      console.debug(`LocaleSyncService: Successfully synced locale ${locale} to backend`);
    } catch (error) {
      // Log error but don't throw - locale is already updated in i18n (optimistic update)
      console.error(new Error(`LocaleSyncService: Failed to sync locale ${locale} to backend`, { cause: error }));
    }
  }

  /**
   * Handle locale synchronization on login.
   * If the frontend locale differs from the backend locale, update the backend.
   *
   * @param {string} backendLocale - The locale stored in backend preferences.
   * @param {Locale} frontendLocale - The current i18n locale.
   * @returns {Promise<void>}
   */
  public async syncOnLogin(backendLocale: string, frontendLocale: Locale): Promise<void> {
    // Validate that the comparison makes sense
    if (backendLocale === frontendLocale) {
      console.debug("LocaleSyncService: Locales match, no sync needed");
      return;
    }

    console.debug(
      `LocaleSyncService: Frontend locale (${frontendLocale}) differs from backend (${backendLocale}), syncing to backend`
    );
    await this.syncLocaleToBackend(frontendLocale);
  }

  /**
   * Wait for any pending sync to complete.
   * This ensures that the locale is synced to the backend before proceeding.
   * Useful when performing actions that depend on the correct backend locale (e.g., sending a message).
   *
   * Note: Failures in the underlying sync are logged but do not prevent the wait
   * from completing. This is intentional - we use optimistic updates for i18n,
   * so even if backend sync fails, the frontend locale has already been updated.
   * Backend sync failures will be retried on next login.
   *
   * @returns {Promise<void>}
   */
  public async waitForPendingSync(): Promise<void> {
    try {
      if (this.pendingSync) {
        await this.pendingSync;
      }
    } catch (e) {
      // Log error but don't propagate - see method documentation for rationale
      console.error("LocaleSyncService: Failed to wait for pending sync", e);
    }
  }

  /**
   * Apply the backend locale to the frontend i18n.
   * Used on page refresh for authenticated users.
   * Validates that the backend locale is supported before applying.
   *
   * @param {string} backendLocale - The locale from backend preferences.
   * @returns {Promise<void>}
   */
  public async applyBackendLocale(backendLocale: string): Promise<void> {
    // Validate the backend locale is supported
    if (!SupportedLocales.includes(backendLocale as Locale)) {
      console.warn(
        `LocaleSyncService: Backend locale "${backendLocale}" is not supported. Supported: ${SupportedLocales.join(", ")}. Falling back to ${FALL_BACK_LOCALE}`
      );
      await i18n.changeLanguage(FALL_BACK_LOCALE);
      return;
    }

    // Only change if different from the current
    if (i18n.language !== backendLocale) {
      console.debug(`LocaleSyncService: Applying backend locale ${backendLocale} to frontend`);
      await i18n.changeLanguage(backendLocale);
    }
  }

  /**
   * Check if a user is currently authenticated (has user preferences).
   * @returns {boolean} True if authenticated, false otherwise.
   */
  public isAuthenticated(): boolean {
    return UserPreferencesStateService.getInstance().getUserPreferences() !== null;
  }
}
