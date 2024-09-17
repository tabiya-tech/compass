// mute chatty console
import "src/_test_utilities/consoleMock";
import { logoutService } from "src/auth/services/logout/logout.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { socialAuthService } from "src/auth/services/socialAuth/SocialAuth.service";
import { anonymousAuthService } from "src/auth/services/anonymousAuth/AnonymousAuth.service";
import { emailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";
import { AuthServices } from "src/auth/auth.types";

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
    test("should successfully logout using the social service logout", async () => {
      // GIVEN the user is logged in with social login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.SOCIAL);
      //@ts-ignore
      jest.spyOn(socialAuthService, "handleLogout").mockResolvedValue(undefined);

      // WHEN the logout is attempted
      const logoutCallback = async () => await logoutService.handleLogout();

      // THEN the logout should succeed
      await expect(logoutCallback()).resolves.toBeUndefined();
    });

    test("should throw an error on social auth service logout error", async () => {
      // GIVEN the user is logged in with social login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.SOCIAL);
      const mockError = new Error("Logout failed");
      //@ts-ignore
      jest.spyOn(socialAuthService, "handleLogout").mockRejectedValue(mockError);

      // WHEN the logout is attempted
      const logoutCallback = async () => await logoutService.handleLogout();

      // THEN the logout should throw an error
      await expect(logoutCallback()).rejects.toThrow("Logout failed");
    });

    test("should successfully logout using anonymous service logout", async () => {
      // GIVEN the user is logged in with anonymous login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.ANONYMOUS);
      //@ts-ignore
      jest.spyOn(anonymousAuthService, "handleLogout").mockResolvedValue(undefined);

      // WHEN the logout is attempted
      const logoutCallback = async () => await logoutService.handleLogout();

      // THEN the logout should succeed
      await expect(logoutCallback()).resolves.toBeUndefined();
    });

    test("should throw an error on anonymous auth service logout error", async () => {
      // GIVEN the user is logged in with anonymous login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.ANONYMOUS);
      const mockError = new Error("Logout failed");
      //@ts-ignore
      jest.spyOn(anonymousAuthService, "handleLogout").mockRejectedValue(mockError);

      // WHEN the logout is attempted
      const logoutCallback = async () => await logoutService.handleLogout();

      //THEN the logout should throw an error
      await expect(logoutCallback()).rejects.toThrow("Logout failed");
    });

    test("should successfully logout using email service logout", async () => {
      // GIVEN the user is logged in with email login
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue(AuthServices.EMAIL);
      //@ts-ignore
      jest.spyOn(emailAuthService, "handleLogout").mockResolvedValue();

      // WHEN the logout is attempted
      const logoutCallback = async () => await logoutService.handleLogout();

      // THEN the logout should succeed
      await expect(logoutCallback()).resolves.toBeUndefined();
    });

    test("should throw an error on email auth service logout error", async () => {
      // GIVEN the user has an invalid login method
      (PersistentStorageService.getLoginMethod as jest.Mock).mockReturnValue("INVALID_METHOD");

      // WHEN the logout is attempted
      const logoutCallback = async () => await logoutService.handleLogout();

      // THEN the logout should throw an error
      await expect(logoutCallback()).rejects.toThrow("Invalid login method");
    });
  });
});
