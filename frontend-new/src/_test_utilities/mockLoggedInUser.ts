import {
  EmailAuthContextValue,
  TabiyaUser,
  emailAuthContextDefaultValue,
} from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";

export function mockLoggedInUser(mockedValues: Partial<EmailAuthContextValue>) {
  let user: TabiyaUser = mockedValues.user || TestUser;
  jest.spyOn(require("src/auth/hooks/useAuthUser"), "useAuthUser").mockReturnValue({
    ...emailAuthContextDefaultValue,
    user: user,
    updateUser: (user: TabiyaUser) => null,
    updateUserByToken: () => {},
    ...mockedValues,
  });
}

export const TestUser = {
  id: "0001",
  name: "Test User",
  email: "test@email.com",
};
