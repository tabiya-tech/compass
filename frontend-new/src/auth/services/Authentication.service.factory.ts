import AuthenticationService from "./Authentication.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import FirebaseEmailAuthenticationService from "./FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import FirebaseInvitationCodeAuthenticationService from "./FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import FirebaseSocialAuthenticationService from "./FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import { AuthenticationServices } from "src/auth/auth.types";
import stdFirebaseAuthenticationService from "./FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import AuthenticationStateService from "./AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

/**
 * AuthenticationServiceFactory is responsible for providing the appropriate
 * AuthenticationService instance based on the current login method.
 * Currently supported authentication methods are firebase-anonymous, firebase-email, and firebase-social.
 *
 * Role:
 * - Acts as a centralized point for obtaining the correct authentication service.
 * - Abstracts the complexity of choosing the right authentication service from the rest of the application.
 *
 * Responsibilities:
 * - Determines the current authentication method from PersistentStorageService.
 * - Returns the appropriate AuthenticationService instance based on the authentication method.
 * - Ensures that only valid authentication services are provided.
 *
 * Boundaries:
 * - Does not manage the setting of the current AuthenticationService. This is managed by the individual AuthenticationService implementations.
 * - Does not perform any authentication operations itself.
 * - Does not store or cache AuthenticationService instances.
 * - Relies on individual AuthenticationService implementations to manage their own instances.
 * - Only works with authentication methods defined in the AuthenticationServices enum.
 *
 * Usage:
 * This factory should be used whenever the current AuthenticationService is needed in the application, for example, when logging out.
 * It provides a single point of access for authentication services, allowing for easy swapping
 * or addition of new authentication methods in the future.
 *
 * Example:
 * When the login button is clicked, the FirebaseEmailAuthenticationService singleton instance is used to log the user in.
 * FirebaseEmailAuthenticationService sets the current authentication service to be something like FIREBASE_EMAIL once the user is logged in.
 * We can get the current authentication service by calling AuthenticationServiceFactory.getAuthenticationService()
 * which will return the FirebaseEmailAuthenticationService instance.
 */
class AuthenticationServiceFactory {
  /**
   * Retrieves an instance of the appropriate AuthenticationService based on the user's current login method.
   *
   * @returns {AuthenticationService} The instance of the authentication service.
   * @throws {Error} If an invalid or unrecognized authentication method is encountered.
   */
  static getCurrentAuthenticationService(): AuthenticationService | null {
    const authMethod = PersistentStorageService.getLoginMethod();

    switch (authMethod) {
      case AuthenticationServices.FIREBASE_ANONYMOUS:
        return FirebaseInvitationCodeAuthenticationService.getInstance();
      case AuthenticationServices.FIREBASE_EMAIL:
        return FirebaseEmailAuthenticationService.getInstance();
      case AuthenticationServices.FIREBASE_SOCIAL:
        return FirebaseSocialAuthenticationService.getInstance();
      case "":
      case null:
        console.debug("The authentication method is or empty. The user is not logged in.");
        return null;
      default:
        PersistentStorageService.clearLoginMethod();
        console.warn("The authentication method is invalid.");
        return null;
    }
  }

  /**
   * Used to bring the application state to a predictable state on page load.
   */
  static async resetAuthenticationState(): Promise<void> {
    // As we don't necessarily know the current authentication service, we have to go to all implementations of authentication service and logout
    // since we currently only have firebase, we can go to the stdFirebaseAuthenticationService and logout
    await stdFirebaseAuthenticationService.getInstance().logout();
    AuthenticationStateService.getInstance().clearUser();
    AuthenticationStateService.getInstance().clearToken();
    UserPreferencesStateService.getInstance().clearUserPreferences();
    // Don't clear login method, we want to preserve the login method for other logins (e.g on a different tab)
    // the login method will be overwritten by the next login (doesnt need to be cleared)
    PersistentStorageService.clearPersonalInfo();
    PersistentStorageService.clearAccountConverted();
    PersistentStorageService.clearToken();
  }
}

export default AuthenticationServiceFactory;
