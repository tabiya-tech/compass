import "src/_test_utilities/consoleMock";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import * as jwtDecodeUtils from "jwt-decode";
import { TabiyaUser } from "src/auth/auth.types";
import { renderHook, act } from "src/_test_utilities/test-utils";

const givenUser: TabiyaUser = {
  name: "Test User",
  email: "foo@bar.baz",
};

const jwtDecodeFn = jest.spyOn(jwtDecodeUtils, "jwtDecode");

describe("useAuthUser hook tests", () => {
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
      result.current.setUser(testUser);
    });

    // THEN: The user is updated
    expect(result.current.user).toEqual(testUser);
  });

  test("updating a new user to override the already existing user", () => {
    // GIVEN the hook is used
    const { result } = renderHook(() => useAuthUser());

    // AND user with username foo is in the state
    act(() => result.current.setUser({ name: "foo", email: "foo@bar.baz" }));
    // sanity check
    expect(result.current.user).toEqual({ name: "foo", email: "foo@bar.baz" });

    // WHEN the user is updated
    act(() => result.current.setUser({ name: "bar", email: "bar@foo.baz" }));

    // THEN the user should be updated
    expect(result.current.user).toEqual({ name: "bar", email: "bar@foo.baz" });
  });

  describe("updateUserByAccessToken", () => {
    const userName = "test";

    const user = {
      name: userName,
      email: "foo@bar.baz",
    };

    test("successful case", () => {
      jwtDecodeFn.mockReturnValue({ name: userName, email: "foo@bar.baz" });

      // GIVEN the hook is used
      const { result } = renderHook(() => useAuthUser());

      // AND No user is set
      expect(result.current.user).toBeNull();

      // WHEN the user is updated by an access token
      act(() => result.current.updateUserByAccessToken("foo"));

      // THEN the user should be updated
      expect(result.current.user).toEqual(user);
    });

    test("Invalid token provided", () => {
      jwtDecodeFn.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      // GIVEN the hook is used
      const { result } = renderHook(() => useAuthUser());

      // AND No user is set
      expect(result.current.user).toBeNull();

      // WHEN the user is updated by an access token
      act(() => result.current.updateUserByAccessToken("foo"));

      // THEN the user should be updated
      expect(result.current.user).toBeNull();
    });
  });
});
