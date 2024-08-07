import { renderHook, act } from "src/_test_utilities/test-utils";
import { useTokens } from "src/auth/hooks/useTokens";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { jwtDecode } from "jwt-decode";

jest.mock("src/app/PersistentStorageService/PersistentStorageService");
jest.mock("jwt-decode");

describe("useTokens hook tests", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getToken", () => {
    test("should return token from persistent storage", () => {
      // GIVEN a token in persistent storage
      const token = "mock-token";
      (PersistentStorageService.getToken as jest.Mock).mockReturnValue(token);

      // WHEN the hook is used
      const { result } = renderHook(() => useTokens());

      // THEN the token should be returned
      expect(result.current.getToken()).toBe(token);
    });
  });

  describe("setToken", () => {
    test("should set token in persistent storage", () => {
      // GIVEN a token to set
      const token = "mock-token";

      // WHEN the hook is used
      const { result } = renderHook(() => useTokens());

      // AND the token is set
      act(() => {
        result.current.setToken(token);
      });

      // THEN the token should be set in persistent storage
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(token);
    });
  });

  describe("clearToken", () => {
    test("should clear token from persistent storage", () => {
      // GIVEN the hook is used
      const { result } = renderHook(() => useTokens());

      // WHEN the token is cleared
      act(() => {
        result.current.clearToken();
      });

      // THEN the token should be cleared from persistent storage
      expect(PersistentStorageService.clear).toHaveBeenCalled();
    });
  });

  describe("getUserFromToken", () => {
    test("should return user from Google OAuth token", () => {
      // GIVEN a Google OAuth token
      const token = "mock-google-token";
      const decodedToken = {
        iss: "accounts.google.com",
        sub: "0000",
        email: "foo@bar.baz",
        email_verified: true,
      };
      (jwtDecode as jest.Mock).mockReturnValue(decodedToken);

      // WHEN the hook is used
      const { result } = renderHook(() => useTokens());

      // AND the user is extracted from the token
      const user = result.current.getUserFromToken(token);

      // THEN the user should be returned
      expect(user).toEqual({
        id: decodedToken.sub,
        name: decodedToken.email,
        email: decodedToken.email,
      });
    });

    test("should return user from Firebase Password token", () => {
      // GIVEN a Firebase Password token
      const token = "mock-firebase-token";
      const decodedToken = {
        name: "Foo Bar",
        iss: "https://foo.bar/baz",
        aud: "foo.bar.baz",
        auth_time: 1718826735,
        user_id: "0001",
        sub: "0002",
        iat: 1718826735,
        exp: 1718830335,
        email: "foo@bar.baz",
        email_verified: true,
        firebase: {
          identities: {
            email: ["foo@bar.baz"],
          },
          sign_in_provider: "password",
        },
      };
      (jwtDecode as jest.Mock).mockReturnValue(decodedToken);

      // WHEN the hook is used
      const { result } = renderHook(() => useTokens());

      // AND the user is extracted from the token
      const user = result.current.getUserFromToken(token);

      // THEN the user should be returned
      expect(user).toEqual({
        id: decodedToken.user_id,
        name: decodedToken.name,
        email: decodedToken.email,
      });
    });

    test("should return null for invalid token", () => {
      // GIVEN an invalid token
      const token = "invalid-token";
      (jwtDecode as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      // WHEN the hook is used
      const { result } = renderHook(() => useTokens());

      // AND the user is extracted from the token
      const user = result.current.getUserFromToken(token);

      // THEN null should be returned
      expect(user).toBeNull();
    });
  });
});
