import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import Register from "./Register";
import { AuthContext, authContextDefaultValue } from "src/auth/AuthProvider/AuthProvider";

const meta: Meta<typeof Register> = {
  title: "Auth/EmailAuth/RegisterWithEmail",
  component: Register,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const mockAuthContextValue = {
        ...authContextDefaultValue,
        register: action("register"),
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

export const Shown: StoryObj<typeof Register> = {
  args: {},
};

export const Registering: StoryObj<typeof Register> = {
  args: {},
  render: (props) => {
    return (
      <AuthContext.Provider
        value={{
          ...authContextDefaultValue,
          isRegisteringWithEmail: true,
        }}
      >
        <Register {...props} />
      </AuthContext.Provider>
    );
  },
};
