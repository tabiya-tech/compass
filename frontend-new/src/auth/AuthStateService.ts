// import { auth } from "src/auth/firebaseConfig";
import { AuthMethods, FirebaseToken, TabiyaUser } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { logoutService } from "src/auth/services/logout/logout.service";
// import firebase from "firebase/compat/app";
import { jwtDecode } from "jwt-decode";

// const REFRESH_TOKEN_EXPIRATION_PERCENTAGE = 0.1;

class AuthStateService {
  private static instance: AuthStateService;
  private user: TabiyaUser | null = null;
  private isAuthenticated = false;
  private isAuthenticationInProgress = false;
  private FIREBASE_DB_NAME = "firebaseLocalStorageDb";

  private constructor() {}

  public static getInstance(): AuthStateService {
    if (!AuthStateService.instance) {
      AuthStateService.instance = new AuthStateService();
    }
    return AuthStateService.instance;
  }

  public getUser(): TabiyaUser | null {
    return this.user;
  }

  public isAuthInProgress(): boolean {
    return this.isAuthenticationInProgress;
  }

  public isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  private setUser(user: TabiyaUser | null) {
    this.user = user;
  }

  private setIsAuthenticated(isAuthenticated: boolean) {
    this.isAuthenticated = isAuthenticated;
  }

  private setIsAuthInProgress(isInProgress: boolean) {
    this.isAuthenticationInProgress = isInProgress;
  }

  private async deleteFirebaseDB() {
    try {
      indexedDB.deleteDatabase(this.FIREBASE_DB_NAME);
    } catch (error) {
      console.error("Failed to delete user from Firebase DB", error);
    }
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

  public clearUser() {
    this.setIsAuthInProgress(true);
    PersistentStorageService.clearToken();
    this.setUser(null);
    this.deleteFirebaseDB();
    this.setIsAuthInProgress(false);
  }

  public updateUserByToken(token: string): TabiyaUser | null {
    try {
      const _user = this.getUserFromToken(token);
      if (_user) {
        PersistentStorageService.setToken(token)
        this.setUser(_user);
        this.setIsAuthenticated(true);
        return _user;
      }
      return null;
    } catch (error) {
      console.error("Invalid token", error);
      return null;
    }
  }

  public async loadUser() {
    this.setIsAuthInProgress(true);
    if (PersistentStorageService.getLoggedOutFlag()) {
      try {
        await logoutService.handleLogout();
        this.clearUser();
      } catch (e) {
        console.error("Failed to logout user on page load", e);
        this.clearUser();
      }
    }
    const token = PersistentStorageService.getToken();
    if (token) {
      this.updateUserByToken(token);
    } else {
      this.clearUser();
    }
    this.setIsAuthInProgress(false);
  }

  // TODO: figure out how to set this up
  // public monitorTokenExpiration(refreshTimeout: NodeJS.Timeout) {
  //   if (auth.currentUser !== null) {
  //     auth.currentUser?.getIdTokenResult().then((idTokenResult) => {
  //       const expirationTime = new Date(idTokenResult.expirationTime).getTime();
  //       const currentTime = new Date().getTime();
  //       const timeToExpiration = expirationTime - currentTime;
  //
  //       refreshTimeout = setTimeout(async () => {
  //         try {
  //           const newToken = await auth.currentUser?.getIdToken(true);
  //           this.updateUserByToken(newToken!);
  //           this.monitorTokenExpiration(refreshTimeout);
  //         } catch (error) {
  //           console.error("Failed to refresh token:", error);
  //           try {
  //             await logoutService.handleLogout();
  //           } catch (e) {
  //             console.error("Failed to logout", e);
  //           } finally {
  //             this.clearUser();
  //           }
  //         }
  //       }, timeToExpiration - timeToExpiration * REFRESH_TOKEN_EXPIRATION_PERCENTAGE);
  //     });
  //   }
  // }

  // TODO: figure out how to set this up
  // public setupAuthListener() {
  //   const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
  //     if (user) {
  //       const token = await user.getIdToken(true);
  //       this.updateUserByToken(token);
  //       this.setIsAuthenticated(true);
  //       let refreshTimeout: NodeJS.Timeout;
  //       this.monitorTokenExpiration(refreshTimeout);
  //     } else {
  //       this.setIsAuthenticated(false);
  //       this.clearUser();
  //     }
  //     this.setIsAuthInProgress(false);
  //   });
  //
  //   return unsubscribe;
  // }
}

export default AuthStateService.getInstance();
