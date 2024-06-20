import { AuthContextValue, TabiyaUser, authContextDefaultValue } from "src/auth/AuthProvider";

export function mockLoggedInUser(mockedValues: Partial<AuthContextValue>) {
  let user: TabiyaUser = mockedValues.user || TestUser;
  jest.spyOn(require("src/auth/hooks/useAuthUser"), "useAuthUser").mockReturnValue({
    ...authContextDefaultValue,
    user: user,
    updateUser: (user: TabiyaUser) => null,
    updateUserByAccessToken: () => {},
    ...mockedValues,
  });
}

export const TestUser = {
  id: "0001",
  name: "Test User",
  email: "test@email.com",
};
