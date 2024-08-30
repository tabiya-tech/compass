import { auth } from "src/auth/firebaseConfig";
import { AuthMethods, FirebaseToken, TabiyaUser } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { jwtDecode } from "jwt-decode";
import { logoutService } from "./services/logout/logout.service";

const REFRESH_TOKEN_EXPIRATION_PERCENTAGE = 0.1;

class AuthStateService {
  private static instance: AuthStateService;
  private user: TabiyaUser | null = null;
  private FIREBASE_DB_NAME = "firebaseLocalStorageDb";
  private refreshTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    console.debug("Initializing");
  }

  public static getInstance(): AuthStateService {
    if (!AuthStateService.instance) {
      AuthStateService.instance = new AuthStateService();
    }
    return AuthStateService.instance;
  }

  public getUser(): TabiyaUser | null {
    return this.user;
  }

  private setUser(user: TabiyaUser | null) {
    this.user = user;
  }

  private async deleteFirebaseDB(): Promise<void> {
    return new Promise((resolve) => {
      console.debug("Attempting to delete Firebase IndexedDB");

      const DBDeleteRequest = window.indexedDB.deleteDatabase(this.FIREBASE_DB_NAME);
      const timeoutDuration = 1000; // 1 second timeout

      const timeoutId = setTimeout(() => {
        console.warn("Firebase IndexedDB deletion timed out or blocked");
        resolve();
      }, timeoutDuration);

      DBDeleteRequest.onerror = (event) => {
        console.error("Error deleting Firebase IndexedDB", event);
        clearTimeout(timeoutId);
        resolve();
      };

      DBDeleteRequest.onsuccess = (event) => {
        console.debug("Firebase IndexedDB deleted successfully");
        clearTimeout(timeoutId);
        resolve();
      };

      DBDeleteRequest.onblocked = (event) => {
        console.warn("Firebase IndexedDB deletion blocked", event);
        // No need to do anything here, as the timeout will handle it
      };
    });
  }

  private getUserFromToken = (token: string): TabiyaUser | null => {
    try {
      const decodedToken: FirebaseToken = jwtDecode(token);
      const GOOGLE_ISSUER = "accounts.google.com";
      if (decodedToken.iss === GOOGLE_ISSUER) {
        // Google OAuth Token
        return {
          id: decodedToken.sub,
          name: decodedToken.name || decodedToken.email, // Google tokens might not have a name field
          email: decodedToken.email,
        };
      } else if (decodedToken.firebase?.sign_in_provider) {
        // Firebase Token
        const signInProvider = decodedToken.firebase.sign_in_provider;
        if (signInProvider === AuthMethods.PASSWORD) {
          // Firebase Password Auth Token
          return {
            id: decodedToken.user_id,
            name: decodedToken.name,
            email: decodedToken.email,
          };
        } else {
          // Other Firebase Auth Providers (e.g., Facebook, Twitter, etc.)
          return {
            id: decodedToken.user_id,
            name: decodedToken.name || decodedToken.email, // Use email if name is not available
            email: decodedToken.email,
          };
        }
      } else {
        throw new Error("Unknown token issuer");
      }
    } catch (error) {
      return null;
    }
  }

  public async clearUser() {
    console.debug("AuthStateService: Clearing user");
    PersistentStorageService.clearToken();
    this.setUser(null);
    this.clearRefreshTimeout();

    try {
      await this.deleteFirebaseDB();
    } catch (error) {
      console.error("AuthStateService: Failed to delete Firebase IndexedDB", error);
    }
  }

  public updateUserByToken(token: string): TabiyaUser | null {
    try {
      const _user = this.getUserFromToken(token);
      if (_user) {
        PersistentStorageService.setToken(token)
        this.setUser(_user);
        return _user;
      }
      return null;
    } catch (error) {
      console.error("Invalid token", error);
      return null;
    }
  }

  private isTokenValid(token: string): boolean {
    try {
      const decodedToken: FirebaseToken = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check if token is expired
      if (decodedToken.exp < currentTime) {
        console.debug("Token is expired");
        return false;
      }

      // Check if token was issued in the future (should never happen, but good to check)
      if (decodedToken.iat > currentTime) {
        console.debug("Token issued in the future");
        return false;
      }

      console.debug("Token checked. Token is valid")
      return true;
    } catch (error) {
      console.error("Error decoding token:", error);
      return false;
    }
  }

  public async loadUser(): Promise<TabiyaUser | null> {
    console.debug("Loading user");
    // TODO: needs to be moved out of this service (doesn't belong here)
    if (PersistentStorageService.getLoggedOutFlag()) {
      try {
        await logoutService.handleLogout();
        await this.clearUser();
      } catch (e) {
        console.error("Failed to logout user on page load", e);
        await this.clearUser();
      }
    }
    const token = PersistentStorageService.getToken();
    
    if (token && this.isTokenValid(token)) {
      console.debug("Valid token found in storage");
      return this.updateUserByToken(token);
    } else {
      console.debug("No valid token found in storage");
      await this.clearUser(); // Clear user data if token is invalid or missing
      return null;
    }
  }

  public async refreshToken() {
    console.debug("Attempting to refresh token");
    const oldToken = PersistentStorageService.getToken();
    console.debug("Old token", "..." + oldToken?.slice(-20));
  
    if (auth.currentUser) {
      try {
        const newToken = await auth.currentUser.getIdToken(true);
        console.debug("New token obtained", "..." + newToken.slice(-20));
        this.updateUserByToken(newToken);
        this.scheduleTokenRefresh(newToken);
        return newToken;
      } catch (error) {
        console.error("Error refreshing token:", error);
        await this.clearUser();
        return null;
      }
    } else {
      console.debug("No current user to refresh token");
      return null;
    }
  }

  private scheduleTokenRefresh(token: string) {
    console.debug("Scheduling next token refresh");
    this.clearRefreshTimeout();

    const decodedToken: FirebaseToken = jwtDecode(token);
    const expirationTime = decodedToken.exp * 1000;
    const currentTime = Date.now();
    const timeToExpiration = expirationTime - currentTime;
    const refreshTime = timeToExpiration- (timeToExpiration * REFRESH_TOKEN_EXPIRATION_PERCENTAGE); // Refresh token 10% before expiration

    console.debug(`Next refresh scheduled in ${refreshTime / 1000} seconds`);

    this.refreshTimeout = setTimeout(() => {
      this.refreshToken();
    }, refreshTime);
  }

  public clearRefreshTimeout() {
    console.debug("Clearing refresh timeout");
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  public setupAuthListener() {
    console.debug("Setting up auth listener");
    return auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.debug("User authenticated");
        const token = await user.getIdToken(true);
        this.scheduleTokenRefresh(token);
      } else {
        console.debug("User not authenticated");
      }
    });
  }
}

export default AuthStateService.getInstance();
