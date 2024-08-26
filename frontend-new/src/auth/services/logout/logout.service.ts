import { AuthService, AuthServices } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { socialAuthService } from "src/auth/services/socialAuth/SocialAuth.service";
import { anonymousAuthService } from "src/auth/services/anonymousAuth/AnonymousAuth.service";
import { emailAuthService } from "src/auth//services/emailAuth/EmailAuth.service";

export class LogoutService {
  private static instance: LogoutService;

  private constructor() {}

  /**
   * Get the singleton instance of the LogoutService.
   * @returns {LogoutService} The singleton instance of the LogoutService.
   */
  static getInstance(): LogoutService {
    if (!LogoutService.instance) {
      LogoutService.instance = new LogoutService();
    }
    return LogoutService.instance;
  }

  /**
   * Handle user logout, based on the login method that is found in the persistent storage.
   * @returns {Promise<void>}
   */
  async handleLogout(): Promise<void> {
    // set the login method to email for future reference
    // we'll want to know how the user logged in, when we want to log them out for example
      const userLoginMethod = PersistentStorageService.getLoginMethod();
      let authService: AuthService;
      // Call the appropriate logout method based on the login method
      switch (userLoginMethod) {
        case AuthServices.SOCIAL:
          authService = socialAuthService;
          break;
        case AuthServices.ANONYMOUS:
          authService = anonymousAuthService;
          break;
        case AuthServices.EMAIL:
          authService = emailAuthService;
          break;
        default:
          throw new Error("Invalid login method");
      }
      await authService.handleLogout();
  }
}

export const logoutService = LogoutService.getInstance();
