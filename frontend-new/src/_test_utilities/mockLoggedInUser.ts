import { AuthContextValue, TabiyaUser, authContextDefaultValue } from "src/auth/AuthProvider";

export function mockLoggedInUser(mockedValues: Partial<AuthContextValue>) {
  let user: TabiyaUser = mockedValues.user || TestUser;
  jest.spyOn(require("src/auth/hooks/useAuthUser"), "useAuthUser").mockReturnValue({
    ...authContextDefaultValue,
    user: user,
    setUser: (user: TabiyaUser) => null,
    updateUserByAccessToken: () => {},
    ...mockedValues,
  });
}

export const TestUser = {
  name: "Test User",
  email: "test@email.com",
};
