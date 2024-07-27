import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import Login from "./Login";
import { AuthContext, authContextDefaultValue } from "src/auth/AuthProvider/AuthProvider";

const meta: Meta<typeof Login> = {
  title: "Auth/Login",
  tags: ["autodocs"],
  component: Login,
  decorators: [
    (Story) => {
      const mockAuthContextValue = {
        ...authContextDefaultValue,
        login: action("login"),
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

export const Shown: StoryObj<typeof Login> = {
  args: {},
};

export const LoggingIn: StoryObj<typeof Login> = {
  args: {},
  render: (props) => {
    return (
      <AuthContext.Provider
        value={{
          ...authContextDefaultValue,
          isLoggingIn: true,
        }}
      >
        <Login {...props} />
      </AuthContext.Provider>
    );
  },
};
