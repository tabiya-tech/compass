// mute chatty console
import "src/_test_utilities/consoleMock";
import { AuthService } from "src/auth/services/AuthService";
import { jwtDecode } from "jwt-decode";
import firebase from "firebase/compat/app";

jest.mock("jwt-decode");

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signInWithCustomToken: jest.fn(),
      signInWithEmailAndPassword: jest.fn(),
      createUserWithEmailAndPassword: jest.fn(),
      signOut: jest.fn(),
    }),
  };
});

jest.useFakeTimers();

const givenRefreshResponse = {
  access_token: "foo",
  id_token: "foo",
  expires_in: 3600,
};

describe("AuthService class tests", () => {
  let authService: AuthService;

  beforeAll(() => {
    authService = AuthService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleRefreshingTokens", () => {
    const givenResponseBody = {
      id_token: "id_token",
      expires_in: 3600,
    };

    test("should call fetch with passed code", async () => {
      // GIVEN the code from firebase
      const refreshToken = "refresh_token";

      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenResponseBody.id_token),
      } as Partial<firebase.User>;

      jest.spyOn(firebase.auth(), "signInWithCustomToken").mockResolvedValue({
        user: mockUser,
      } as firebase.auth.UserCredential);

      // WHEN the handler is called
      let response = await authService.handleRefreshingTokens(refreshToken);

      // THEN the response should be the expected response
      expect(response).toEqual(givenResponseBody);
    });

    test("should throw a Failed to Fetch error when the firebase signIn method fails to return a user", async () => {
      // GIVEN the code from firebase
      const refreshToken = "refresh_token";

      // AND the firebase signIn method fails to return a user
      jest.spyOn(firebase.auth(), "signInWithCustomToken").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      // WHEN the handler is called
      // THEN test should throw an error
      await expect(authService.handleRefreshingTokens(refreshToken)).toReject("Failed to Fetch");
    });

    test("When no refreshToken is provided, test should throw an error", async () => {
      // GIVEN no code is provided
      const refreshToken = "undefined";

      // WHEN exchangeCodeWithTokens is called with the code

      // THEN test should throw an error
      await expect(authService.handleRefreshingTokens(refreshToken)).toReject();
    });
  });

  describe("initiateRefreshTokens", () => {
    const givenSuccessCallback = jest.fn();
    const givenUnauthorizedCallback = jest.fn();

    test("should continue to call the handleRefreshingTokens with the refresh token", async () => {
      const handleRefreshingTokens = jest
        .spyOn(authService, "handleRefreshingTokens")
        .mockResolvedValue(givenRefreshResponse);

      expect(handleRefreshingTokens).toHaveBeenCalledTimes(0);
      expect(givenSuccessCallback).toHaveBeenCalledTimes(0);

      // GIVEN the refresh token is foo
      const givenRefreshToken = "foo";

      // WHEN initiateRefreshTokens is called with the refresh token
      await authService.initiateRefreshTokens(givenRefreshToken, givenSuccessCallback, givenUnauthorizedCallback);

      // AND test should call handleRefreshingTokens with the refresh token
      expect(handleRefreshingTokens).toHaveBeenCalledTimes(1);
      expect(givenSuccessCallback).toHaveBeenCalledTimes(1);

      const N = 10;

      // WHEN the interval is called at Nth time
      for (let i = 1; i < N; i++) {
        jest.advanceTimersByTime(givenRefreshResponse.expires_in * 1000 - givenRefreshResponse.expires_in * 1000 * 0.1);

        await Promise.resolve();

        // THEN test should call handleRefreshingTokens/callback with the refresh token
        expect(handleRefreshingTokens).toHaveBeenCalledTimes(1 + i); // 1 from the first call

        expect(givenSuccessCallback).toHaveBeenCalledTimes(1 + i); // 1 from the first cal
      }
    });

    test("should not call handleRefreshingTokens when there is already refreshing in progress", async () => {
      const handleRefreshingTokensSpy = jest
        .spyOn(authService, "handleRefreshingTokens")
        .mockResolvedValue(givenRefreshResponse);
      handleRefreshingTokensSpy.mockClear();

      // GIVEN the refresh token is foo
      const refreshToken = "foo";

      // WHEN initiateRefreshTokens is called with the refresh token
      await authService.initiateRefreshTokens(refreshToken, givenSuccessCallback, givenUnauthorizedCallback);

      // THEN handleRefreshingTokens should be called with the refresh token
      expect(handleRefreshingTokensSpy).toHaveBeenCalled();
      expect(handleRefreshingTokensSpy).toHaveBeenCalledWith(refreshToken);

      const TIMES_ELAPSED = 3;

      // WHEN the time elapses when the refreshing is in progress
      jest.advanceTimersByTime(
        TIMES_ELAPSED * (givenRefreshResponse.expires_in * 1000 - givenRefreshResponse.expires_in * 1000 * 0.1)
      );

      // THEN: the handleRefreshingTokens should not be called again
      expect(handleRefreshingTokensSpy.mock.calls.length).toBeLessThan(TIMES_ELAPSED);
    });

    test("should call handleRefreshingTokens with the refresh token", async () => {
      const handleRefreshingTokensSpy = jest
        .spyOn(authService, "handleRefreshingTokens")
        .mockResolvedValue(givenRefreshResponse);

      // GIVEN the refresh token is foo
      const refreshToken = "foo";

      // WHEN initiateRefreshTokens is called with the refresh token
      await authService.initiateRefreshTokens(refreshToken, givenSuccessCallback, givenUnauthorizedCallback);

      // THEN handleRefreshingTokens should be called with the refresh token
      expect(handleRefreshingTokensSpy).toHaveBeenCalled();
      expect(handleRefreshingTokensSpy).toHaveBeenCalledWith(refreshToken);
    });

    test("Should return a timer when the refreshing is initiated", async () => {
      jest.spyOn(authService, "handleRefreshingTokens").mockResolvedValue(givenRefreshResponse);

      // GIVEN the refresh token is foo
      const givenRefreshToken = "foo";

      // WHEN initiateRefreshTokens is called with the refresh token
      let timer = await authService.initiateRefreshTokens(
        givenRefreshToken,
        givenSuccessCallback,
        givenUnauthorizedCallback
      );

      // THEN test should return a timer
      // @ts-ignore
      expect(typeof timer).toBe("number");
    });

    test("Should call the given callback with the response from handleRefreshingTokens", async () => {
      jest.spyOn(authService, "handleRefreshingTokens").mockResolvedValue(givenRefreshResponse);

      // GIVEN the refresh token is foo
      const givenRefreshToken = "foo";

      // WHEN initiateRefreshTokens is called with the refresh token
      await authService.initiateRefreshTokens(givenRefreshToken, givenSuccessCallback, givenUnauthorizedCallback);

      // THEN the callback should be called with the response from handleRefreshingTokens
      expect(givenSuccessCallback).toHaveBeenCalledWith(givenRefreshResponse);
    });

    test("should call setInterval with the correct number", async () => {
      jest.spyOn(authService, "handleRefreshingTokens").mockResolvedValue(givenRefreshResponse);
      const setIntervalSpy = jest.spyOn(global, "setInterval").mockImplementation(jest.fn());

      // GIVEN the refresh token is foo
      const givenRefreshToken = "foo";

      // WHEN initiateRefreshTokens is called with the refresh token
      await authService.initiateRefreshTokens(givenRefreshToken, givenSuccessCallback, givenUnauthorizedCallback);

      const MARGIN = givenRefreshResponse.expires_in * 1000 * 0.1;

      // THEN test should call setInterval with the correct number (expires_in * 1000) * 0.1
      // @ts-ignore
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        givenRefreshResponse.expires_in * 1000 - MARGIN
      );
    });

    test("should call the unauthorized callback when the handleRefreshingTokens throws an error", async () => {
      jest.spyOn(authService, "handleRefreshingTokens").mockRejectedValue({ statusCode: 401 });

      // GIVEN the refresh token is foo
      const givenRefreshToken = "foo";

      // WHEN initiateRefreshTokens is called with the refresh token
      await authService.initiateRefreshTokens(givenRefreshToken, givenSuccessCallback, givenUnauthorizedCallback);

      // THEN the callback should be called with the response from handleRefreshingTokens
      expect(givenUnauthorizedCallback).toHaveBeenCalled();
    });

    test("should should not call unauthorized callback when the status is internal server error", async () => {
      givenUnauthorizedCallback.mockClear();

      jest.spyOn(authService, "handleRefreshingTokens").mockResolvedValue(givenRefreshResponse);

      // GIVEN the refresh token is foo
      const givenRefreshToken = "foo";

      // WHEN initiateRefreshTokens is called with the refresh token
      await authService.initiateRefreshTokens(givenRefreshToken, givenSuccessCallback, givenUnauthorizedCallback);

      // THEN the callback should be called with the response from handleRefreshingTokens
      expect(givenSuccessCallback).toHaveBeenCalled();

      // WHEN the handleRefreshingTokens throws an error
      jest.spyOn(authService, "handleRefreshingTokens").mockRejectedValue({ status: 505 });

      // AND the time elapses
      jest.advanceTimersByTime(givenRefreshResponse.expires_in * 1000 - givenRefreshResponse.expires_in * 1000 * 0.1);

      // THEN test should call the unauthorized callback
      expect(givenUnauthorizedCallback).not.toHaveBeenCalled();
    });
  });

  describe("handleLogin", () => {
    const givenEmail = "test@example.com";
    const givenPassword = "password";
    const givenUser = { email: givenEmail, userId: "123" };
    const givenTokenResponse = {
      id_token: "foo",
      expires_in: 3600,
    };

    test("should call successCallback with user data on successful login", async () => {
      // GIVEN the login credentials are correct
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse.id_token),
      } as Partial<firebase.User>;
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: mockUser,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const errorCallback = jest.fn();
      // AND the token is decoded without any errors
      (jwtDecode as jest.Mock).mockReturnValueOnce(givenUser);

      // WHEN the login is attempted
      await authService.handleLogin(givenEmail, givenPassword, successCallback, errorCallback);

      // THEN test should call the firebase login function with the given email and password
      expect(firebase.auth().signInWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);
      // AND test should call the success callback with the user data
      expect(successCallback).toHaveBeenCalledWith(givenUser);
      // AND test should not call the error callback
      expect(errorCallback).not.toHaveBeenCalled();
    });

    test("should call errorCallback on login failure", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockRejectedValue(new Error("Login failed"));
      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the login is attempted
      await authService.handleLogin(givenEmail, givenPassword, successCallback, errorCallback);

      // THEN test should call the firebase login function with the given email and password
      expect(firebase.auth().signInWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    test("should throw a Failed to Fetch error when the firebase signIn method fails to return a user", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the login is attempted
      await authService.handleLogin(givenEmail, givenPassword, successCallback, errorCallback);
      // THEN the error callback should be called with Failed to Fetch
      await expect(errorCallback).toHaveBeenCalledWith(new Error("Failed to fetch"));
    });
  });

  describe("handleLogout", () => {
    test("should call successCallback on successful logout", async () => {
      // GIVEN the user is logged in
      const mockSignOut = jest.fn();
      jest.spyOn(firebase.auth(), "signOut").mockImplementation(mockSignOut);

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the logout is attempted
      await authService.handleLogout(successCallback, errorCallback);

      // THEN test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
      // AND test should call the success callback
      expect(successCallback).toHaveBeenCalled();
      // AND test should not call the error callback
      expect(errorCallback).not.toHaveBeenCalled();
    });

    test("should call errorCallback on logout failure", async () => {
      // GIVEN the user is logged in
      jest.spyOn(firebase.auth(), "signOut").mockRejectedValue(new Error("Logout failed"));

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the logout is attempted
      await authService.handleLogout(successCallback, errorCallback);

      // THEN test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("handleRegister", () => {
    const givenEmail = "test@example.com";
    const givenPassword = "password";
    const givenUser = { email: givenEmail, userId: "123" };
    const givenTokenResponse = {
      id_token: "foo",
      expires_in: 3600,
    };

    test("should call successCallback with user data on successful registration", async () => {
      // GIVEN the registration credentials are correct
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse.id_token),
      } as Partial<firebase.User>;
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockResolvedValue({
        user: mockUser,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const errorCallback = jest.fn();
      // AND the token is decoded without any errors
      (jwtDecode as jest.Mock).mockReturnValueOnce(givenUser);

      // WHEN the registration is attempted
      await authService.handleRegister(givenEmail, givenPassword, successCallback, errorCallback);

      // THEN test should call the firebase registration function with the given email and password
      expect(firebase.auth().createUserWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);
      // AND test should call the success callback with the user data
      expect(successCallback).toHaveBeenCalledWith(givenUser);
      // AND test should not call the error callback
      expect(errorCallback).not.toHaveBeenCalled();
    });

    test("should call errorCallback on registration failure", async () => {
      // GIVEN the registration credentials are incorrect
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockRejectedValue(new Error("Registration failed"));
      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the registration is attempted
      await authService.handleRegister(givenEmail, givenPassword, successCallback, errorCallback);

      // THEN test should call the firebase registration function with the given email and password
      expect(firebase.auth().createUserWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    test("should throw a Failed to Fetch error when the firebase createUserWithEmailAndPassword method fails to return a user", async () => {
      // GIVEN the registration credentials are incorrect
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the registration is attempted
      await authService.handleRegister(givenEmail, givenPassword, successCallback, errorCallback);
      // THEN the error callback should be called with Failed to Fetch
      await expect(errorCallback).toHaveBeenCalledWith(new Error("Failed to fetch"));
    });
  });
});
