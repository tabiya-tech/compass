// mute chatty console
import "src/_test_utilities/consoleMock";
import { logoutService } from "src/auth/services/logout/logout.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { socialAuthService } from "src/auth/services/socialAuth/SocialAuth.service";
import { anonymousAuthService } from "src/auth/services/anonymousAuth/AnonymousAuth.service";
import { emailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";
import { AuthServices } from "src/auth/auth.types";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";

// mock the SocialAuthServices
jest.mock("src/auth/services/socialAuth/SocialAuth.service", () => {
  return {
    __esModule: true,
    socialAuthService: {
      handleLogout: jest.fn(),
    },
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

// mock the anonymousAuthService
jest.mock("src/auth/services/anonymousAuth/AnonymousAuth.service", () => {
  return {
    anonymousAuthService: {
      handleLogout: jest.fn(),
    },
  };
});

// mock the emailAuthService
jest.mock("src/auth/services/emailAuth/EmailAuth.service", () => {
  return {
    emailAuthService: {
      handleLogout: jest.fn(),
    },
  };
});

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signOut: jest.fn(),
    }),
  };
});

jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => {
  return {
    __esModule: true,
    PersistentStorageService: {
      getLoginMethod: jest.fn(),
      setLoggedOutFlag: jest.fn(),
    },
  };
});

jest.useFakeTimers();

describe("LogoutService class tests", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleLogout", () => {
    test("should call successCallback on successful logout for social login", async () => {
      // GIVEN the user is logged in with social login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.SOCIAL);
      //@ts-ignore
      jest.spyOn(socialAuthService, "handleLogout").mockImplementation((successCallback, failureCallback) => {
        successCallback();
      });

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the logout is attempted
      await logoutService.handleLogout(successCallback, failureCallback);

      // THEN the success callback should be called
      expect(successCallback).toHaveBeenCalled();
      // AND the failure callback should not be called
      expect(failureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback on logout error for social login", async () => {
      // GIVEN the user is logged in with social login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.SOCIAL);
      const mockError = {
        message: "Logout failed",
        code: "auth/logout-failed",
      };
      //@ts-ignore
      jest.spyOn(socialAuthService, "handleLogout").mockImplementation((successCallback, failureCallback) => {
        failureCallback(mockError as unknown as FirebaseError);
      });

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the logout is attempted
      await logoutService.handleLogout(successCallback, failureCallback);

      // THEN the success callback should not be called
      expect(successCallback).not.toHaveBeenCalled();
      // AND the failure callback should be called with the error
      expect(failureCallback).toHaveBeenCalledWith(mockError);
    });

    test("should call successCallback on successful logout for anonymous login", async () => {
      // GIVEN the user is logged in with anonymous login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.ANONYMOUS);
      //@ts-ignore
      jest.spyOn(anonymousAuthService, "handleLogout").mockImplementation((successCallback, failureCallback) => {
        successCallback();
      });

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the logout is attempted
      await logoutService.handleLogout(successCallback, failureCallback);

      // THEN the success callback should be called
      expect(successCallback).toHaveBeenCalled();
      // AND the failure callback should not be called
      expect(failureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback on logout error for anonymous login", async () => {
      // GIVEN the user is logged in with anonymous login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.ANONYMOUS);
      const mockError = new Error("Logout failed");
      //@ts-ignore
      jest.spyOn(anonymousAuthService, "handleLogout").mockImplementation((successCallback, failureCallback) => {
        failureCallback(mockError);
      });

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the logout is attempted
      await logoutService.handleLogout(successCallback, failureCallback);

      // THEN the success callback should not be called
      expect(successCallback).not.toHaveBeenCalled();
      // AND the failure callback should be called with the error
      expect(failureCallback).toHaveBeenCalledWith(mockError);
    });

    test("should call successCallback on successful logout for email login", async () => {
      // GIVEN the user is logged in with email login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.EMAIL);
      //@ts-ignore
      jest.spyOn(emailAuthService, "handleLogout").mockImplementation((successCallback, failureCallback) => {
        successCallback();
      });

      const givenSuccessCallback = jest.fn();
      const givenFailureCallback = jest.fn();

      // WHEN the logout is attempted
      await logoutService.handleLogout(givenSuccessCallback, givenFailureCallback);

      // THEN the success callback should be called
      expect(givenSuccessCallback).toHaveBeenCalled();
      // AND the failure callback should not be called
      expect(givenFailureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback on invalid login method", async () => {
      // GIVEN the user has an invalid login method
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue("INVALID_METHOD");

      const givenSuccessCallback = jest.fn();
      const givenFailureCallback = jest.fn();

      // WHEN the logout is attempted
      await logoutService.handleLogout(givenSuccessCallback, givenFailureCallback);

      // THEN the success callback should not be called
      expect(givenSuccessCallback).not.toHaveBeenCalled();
      // AND the failure callback should be called with the error
      expect(givenFailureCallback).toHaveBeenCalledWith("Invalid login method");
    });
  });
});
