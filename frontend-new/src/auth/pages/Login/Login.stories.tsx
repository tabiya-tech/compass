import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import Login from "./Login";
import { EmailAuthContext, emailAuthContextDefaultValue } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";

const meta: Meta<typeof Login> = {
  title: "Auth/Login",
  tags: ["autodocs"],
  component: Login,
  decorators: [
    (Story) => {
      const mockAuthContextValue = {
        ...emailAuthContextDefaultValue,
        login: action("login"),
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

export const Shown: StoryObj<typeof Login> = {
  args: {},
};

export const LoggingIn: StoryObj<typeof Login> = {
  args: {},
  render: (props) => {
    return (
      <EmailAuthContext.Provider
        value={{
          ...emailAuthContextDefaultValue,
          isLoggingInWithEmail: true,
        }}
      >
        <Login {...props} />
      </EmailAuthContext.Provider>
    );
  },
};
