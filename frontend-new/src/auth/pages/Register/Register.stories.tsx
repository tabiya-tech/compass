import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import Register from "./Register";
import { EmailAuthContext, emailAuthContextDefaultValue } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";

const meta: Meta<typeof Register> = {
  title: "Auth/Register",
  component: Register,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const mockAuthContextValue = {
        ...emailAuthContextDefaultValue,
        register: action("register"),
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

export const Shown: StoryObj<typeof Register> = {
  args: {},
};

export const Registering: StoryObj<typeof Register> = {
  args: {},
  render: (props) => {
    return (
      <EmailAuthContext.Provider
        value={{
          ...emailAuthContextDefaultValue,
          isRegisteringWithEmail: true,
        }}
      >
        <Register {...props} />
      </EmailAuthContext.Provider>
    );
  },
};
