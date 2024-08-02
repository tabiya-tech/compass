import "src/_test_utilities/consoleMock";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import * as jwtDecodeUtils from "jwt-decode";
import { TabiyaUser } from "src/auth/auth.types";
import { renderHook, act } from "src/_test_utilities/test-utils";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";

const givenUser: TabiyaUser = {
  id: "0001",
  name: "Test User",
  email: "foo@bar.baz",
};

const jwtDecodeFn = jest.spyOn(jwtDecodeUtils, "jwtDecode");

// Mock tokens
const googleToken = {
  iss: "accounts.google.com",
  sub: "0000",
  email: "foo@bar.baz",
  email_verified: true,
  azp: "0001.apps.googleusercontent.com",
  aud: "0002.apps.googleusercontent.com",
  at_hash: "foo",
  iat: 1718826805,
  exp: 1718830405,
};

const firebasePasswordToken = {
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

describe("useAuthUser hook tests", () => {
  beforeAll(() => mockUseTokens());

  test("initially has no user", () => {
    // GIVEN: The hook is used in a component
    const { result } = renderHook(() => useAuthUser());

    // WHEN: Initially rendered
    // THEN: The user should be null - no user is set
    expect(result.current.user).toBeNull();
  });

  test("can set a user", () => {
    // GIVEN: The hook is used in a component
    const { result } = renderHook(() => useAuthUser());

    // WHEN: A user is set
    const testUser = givenUser;
    act(() => {
      result.current.updateUser(testUser);
    });

    // THEN: The user is updated
    expect(result.current.user).toEqual(testUser);
  });

  test("updating a new user to override the already existing user", () => {
    // GIVEN the hook is used
    const { result } = renderHook(() => useAuthUser());

    // AND user with username foo is in the state
    act(() => result.current.updateUser({ id: "0001", name: "foo", email: "foo@bar.baz" }));
    // sanity check
    expect(result.current.user).toEqual({ id: "0001", name: "foo", email: "foo@bar.baz" });

    // WHEN the user is updated
    act(() => result.current.updateUser({ id: "0001", name: "bar", email: "bar@foo.baz" }));

    // THEN the user should be updated
    expect(result.current.user).toEqual({ id: "0001", name: "bar", email: "bar@foo.baz" });
  });

  describe("updateUserByToken", () => {
    test("successful case for Google OAuth token", () => {
      jwtDecodeFn.mockReturnValue(googleToken);

      // GIVEN the hook is used
      const { result } = renderHook(() => useAuthUser());

      // AND No user is set
      expect(result.current.user).toBeNull();

      // WHEN the user is updated by an token
      act(() => result.current.updateUserByToken("foo"));

      // THEN the user should be updated
      expect(result.current.user).toEqual({
        id: googleToken.sub,
        name: googleToken.email,
        email: googleToken.email,
      });
    });

    test("successful case for Firebase Password token", () => {
      jwtDecodeFn.mockReturnValue(firebasePasswordToken);

      // GIVEN the hook is used
      const { result } = renderHook(() => useAuthUser());

      // AND No user is set
      expect(result.current.user).toBeNull();

      // WHEN the user is updated by an token
      act(() => result.current.updateUserByToken("foo"));

      // THEN the user should be updated
      expect(result.current.user).toEqual({
        id: firebasePasswordToken.user_id,
        name: firebasePasswordToken.name,
        email: firebasePasswordToken.email,
      });
    });

    test("Invalid token provided", () => {
      jwtDecodeFn.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      // GIVEN the hook is used
      const { result } = renderHook(() => useAuthUser());

      // AND No user is set
      expect(result.current.user).toBeNull();

      // WHEN the user is updated by an token
      act(() => result.current.updateUserByToken("foo"));

      // THEN the user should be null
      expect(result.current.user).toBeNull();
    });
  });
});
