import authStateService, { AuthenticationStateService } from "./AuthenticationState.service";
import {
  userPreferencesStateService,
  UserPreferencesStateService,
} from "src/userPreferences/UserPreferencesStateService";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { StatusCodes } from "http-status-codes";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";

/**
 * Abstract class representing an authentication service.
 * 
 * This class defines the contract for any authentication service implementation.
 * It ensures that all implementing classes provide methods to refresh tokens,
 * perform cleanup operations, and handle logout.
 * 
 * Subclasses must implement the abstract methods to provide specific authentication logic.
 * 
 * All instances of AuthenticationServices should be singletons.
 */
abstract class AuthenticationService {
  private readonly authenticationStateService: AuthenticationStateService;
  private readonly userPreferencesStateService: UserPreferencesStateService;

  protected constructor() {
      this.authenticationStateService = AuthenticationStateService.getInstance();
      this.userPreferencesStateService = UserPreferencesStateService.getInstance();
  }

  /**
   * Abstract methods to implement in the child classes
   */
  abstract refreshToken(): Promise<void>;
  abstract cleanup(): void;
  abstract logout(): Promise<void>;

  /**
   * "callbacks" to be called by the child classes when specific events occur
   */
  async onSuccessfulLogout(): Promise<void> {
    // clear the user from the context, and the persistent storage
    await this.authenticationStateService.clearUser();
    // clear the userPreferences from the "state"
    this.userPreferencesStateService.clearUserPreferences();
    // clear the login method from the persistent storage
    PersistentStorageService.clearLoginMethod();
  }

  async onSuccessfulLogin(token: string): Promise<void> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "AuthenticationService",
      "onSuccessfulRegistration",
      "POST",
      "onSuccessfulRegistration"
    );
    try {
      const user = authStateService.updateUserByToken(token);
      const prefs = await userPreferencesService.getUserPreferences(user!.id);
      if (prefs !== null) {
        // set the local preferences "state" ( for lack of a better word )
        userPreferencesStateService.setUserPreferences(prefs);
      }
    } catch (err) {
      throw firebaseErrorFactory(StatusCodes.INTERNAL_SERVER_ERROR, (err as any).code, (err as any).message);
    }
  }

  async onSuccessfulRegistration(token: string, registrationCode: string): Promise<void> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "AuthenticationService",
      "onSuccessfulRegistration",
      "POST",
      "onSuccessfulRegistration"
    );
    try{
      const _user = authStateService.updateUserByToken(token);
      if (_user) {
        // create user preferences for the first time.
        // in order to do this, there needs to be a logged in user in the persistent storage
        const prefs = await userPreferencesService.createUserPreferences({
          user_id: _user.id,
          invitation_code: registrationCode,
          language: Language.en,
        });
        userPreferencesStateService.setUserPreferences(prefs);
      } else {
        throw new Error("User not found");
      }}
    catch (error) {
      throw firebaseErrorFactory(StatusCodes.INTERNAL_SERVER_ERROR, (error as any).code, (error as any).message);
    }
  }

  async onSuccessfulRefresh(token: string): Promise<void> {
    this.authenticationStateService.updateUserByToken(token);
  }

}

export default AuthenticationService;
