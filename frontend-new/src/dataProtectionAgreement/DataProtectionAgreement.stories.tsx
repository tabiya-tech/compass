import { Meta, StoryObj } from "@storybook/react";
import DataProtectionAgreement from "./DataProtectionAgreement";
import { EmailAuthContext, emailAuthContextDefaultValue } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";

const meta: Meta<typeof DataProtectionAgreement> = {
  title: "Auth/DataProtectionAgreement",
  tags: ["autodocs"],
  component: DataProtectionAgreement,
  decorators: [
    (Story) => {
      const mockAuthContextValue = {
        ...emailAuthContextDefaultValue,
        user: {
          id: "123",
          name: "John Doe",
          email: "johndoe@mail.com",
        },
      };

      return (
        <EmailAuthContext.Provider value={mockAuthContextValue}>
          <Story />
        </EmailAuthContext.Provider>
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
