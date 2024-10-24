import AuthenticationService from "./Authentication.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import FirebaseEmailAuthenticationService from "./FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import FirebaseInvitationCodeAuthenticationService from "./FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import FirebaseSocialAuthenticationService from "./FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import { AuthenticationServices } from "src/auth/auth.types";

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
  static async getCurrentAuthenticationService(): Promise<AuthenticationService> {
    const authMethod = PersistentStorageService.getLoginMethod();

    switch (authMethod) {
      case AuthenticationServices.FIREBASE_ANONYMOUS:
        return await FirebaseInvitationCodeAuthenticationService.getInstance();
      case AuthenticationServices.FIREBASE_EMAIL:
        return await FirebaseEmailAuthenticationService.getInstance();
      case AuthenticationServices.FIREBASE_SOCIAL:
        return await FirebaseSocialAuthenticationService.getInstance();
      default:
        throw new Error(`Invalid authentication method: ${authMethod}`);
    }
  }
}

export default AuthenticationServiceFactory;
