import { auth } from "src/auth/firebaseConfig";
import { TFirebaseTokenResponse } from "src/auth/auth.types";

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async handleLogin(
    email: string,
    password: string,
    successCallback: (data: TFirebaseTokenResponse) => void,
    errorCallback: (error: any) => void
  ): Promise<TFirebaseTokenResponse | undefined> {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      if (!userCredential.user) {
        throw new Error("Failed to fetch");
      }
      if (!userCredential.user.emailVerified) {
        throw new Error("Email not verified");
      }
      const data = {
        id_token: await userCredential.user.getIdToken(),
        expires_in: 3600,
      };
      successCallback(data);
      return data;
    } catch (error) {
      errorCallback(error);
    }
  }

  async handleLogout(successCallback: () => void, errorCallback: (error: any) => void) {
    try {
      await auth.signOut();
      successCallback();
    } catch (error) {
      errorCallback(error);
    }
  }

  async handleRegister(
    email: string,
    password: string,
    name: string,
    successCallback: (data: TFirebaseTokenResponse) => void,
    errorCallback: (error: any) => void
  ): Promise<TFirebaseTokenResponse | undefined> {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      if (!userCredential.user) {
        throw new Error("Failed to fetch");
      }
      await userCredential.user.updateProfile({
        displayName: name,
      });
      await userCredential.user.sendEmailVerification();
      await auth.signOut();
      const data = {
        id_token: await userCredential.user.getIdToken(),
        expires_in: 3600,
      };
      successCallback(data);
      return data;
    } catch (error) {
      errorCallback(error);
    }
  }
}

export const authService = AuthService.getInstance();
