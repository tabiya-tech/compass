import { Meta, StoryObj } from "@storybook/react";
import DataProtectionAgreement from "./DataProtectionPolicy";
import { AuthContext, authContextDefaultValue } from "src/auth/AuthProvider";

const meta: Meta<typeof DataProtectionAgreement> = {
  title: "Auth/DataProtectionAgreement",
  tags: ["autodocs"],
  component: DataProtectionAgreement,
  decorators: [
    (Story) => {
      const mockAuthContextValue = {
        ...authContextDefaultValue,
        user: {
          id: "123",
          name: "John Doe",
          email: "johndoe@mail.com",
        },
      };

      return (
        <AuthContext.Provider value={mockAuthContextValue}>
          <Story />
        </AuthContext.Provider>
      );
    },
  ],
};

export default meta;

export const Shown: StoryObj<typeof DataProtectionAgreement> = {
  args: {},
};

export const AcceptingDPA: StoryObj<typeof DataProtectionAgreement> = {
  args: {
    isLoading: true,
  },
};
