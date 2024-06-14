import { mockLoggedInUser } from "src/_test_utilities/mockLoggedInUser";
import { renderHook } from "src/_test_utilities/test-utils";
import { useContext } from "react";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider";

describe("Mock Logged In User", () => {
  test("it should return the access token when set", () => {
    // GIVEN: The user is set
    const givenUser: TabiyaUser = { id: "0001", name: "foo-1", email: "foo@bar.baz" };
    mockLoggedInUser({ user: givenUser });

    // WHEN: The hook is used in a component
    const { result } = renderHook(() => useContext(AuthContext));

    // THEN: The user should be set
    expect(result.current.user).toEqual(givenUser);
  });
});
