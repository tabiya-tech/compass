import { mockLoggedInUser } from "src/_test_utilities/mockLoggedInUser";
import { renderHook } from "src/_test_utilities/test-utils";
import { useContext } from "react";
import { AuthContext } from "src/auth/AuthProvider";

describe("Mock Logged In User", () => {
  test("it should return the access token when set", () => {
    // GIVEN: The user is set
    mockLoggedInUser({ user: { name: "foo-1", email: "foo@bar.baz" } });

    // WHEN: The hook is used in a component
    const { result } = renderHook(() => useContext(AuthContext));

    // THEN: The user should be set
    expect(result.current.user).toEqual({ name: "foo-1", email: "foo@bar.baz" });
  });
});
