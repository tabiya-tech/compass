import { auth } from "src/auth/firebaseConfig";
import { TabiyaUser, TFirebaseTokenResponse } from "src/auth/auth.types";
import { REFRESH_TOKEN_BEFORE_EOL_PERCENTAGE } from "src/auth/constants";
import { jwtDecode } from "jwt-decode";

let isRefreshingTokens = false;

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
    successCallback: (data: TabiyaUser) => void,
    errorCallback: (error: any) => void
  ): Promise<TFirebaseTokenResponse | undefined> {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      if (!userCredential.user) {
        throw new Error("Failed to fetch");
      }
      const data = {
        id_token: await userCredential.user.getIdToken(),
        expires_in: 3600,
      };
      const user = jwtDecode(data.id_token);
      successCallback(user as TabiyaUser);
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
    successCallback: (data: TabiyaUser) => void,
    errorCallback: (error: any) => void
  ): Promise<TFirebaseTokenResponse | undefined> {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      if (!userCredential.user) {
        throw new Error("Failed to fetch");
      }
      const data = {
        id_token: await userCredential.user.getIdToken(),
        expires_in: 3600,
      };
      const user = jwtDecode(data.id_token);
      successCallback(user as TabiyaUser);
      return data;
    } catch (error) {
      errorCallback(error);
    }
  }

  async handleRefreshingTokens(refreshToken: string): Promise<TFirebaseTokenResponse> {
    if (!refreshToken || refreshToken === "undefined") {
      throw new Error("Invalid Refresh Token");
    }

    try {
      const userCredential = await auth.signInWithCustomToken(refreshToken);
      if (!userCredential.user) {
        throw new Error("Failed to fetch");
      }
      return {
        id_token: await userCredential.user.getIdToken(),
        expires_in: 3600,
      };
    } catch (error) {
      console.error(error);
      throw new Error("Failed to fetch");
    }
  }

  async initiateRefreshTokens(
    refreshToken: string,
    successCallback: (data: TFirebaseTokenResponse) => void,
    unauthorizedCallback: () => void
  ) {
    function handleError(error: any) {
      if (error.statusCode >= 400 && error.statusCode < 500) {
        isRefreshingTokens = false;
        unauthorizedCallback();
      }
    }

    let data;
    try {
      data = await this.handleRefreshingTokens(refreshToken);
      successCallback(data);
    } catch (error: any) {
      handleError(error);
      return;
    }

    const MARGIN = data.expires_in * 1000 * REFRESH_TOKEN_BEFORE_EOL_PERCENTAGE;

    return setInterval(
      () => {
        if (isRefreshingTokens) return;

        isRefreshingTokens = true;

        this.handleRefreshingTokens(refreshToken)
          .then((data) => {
            isRefreshingTokens = false;
            successCallback(data);
          })
          .catch((error) => {
            handleError(error);
          });
      },
      data.expires_in * 1000 - MARGIN
    );
  }
}

export const authService = AuthService.getInstance();
