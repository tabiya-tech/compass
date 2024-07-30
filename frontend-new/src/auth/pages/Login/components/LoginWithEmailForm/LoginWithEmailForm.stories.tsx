import { Meta, StoryObj } from "@storybook/react";
import LoginWithEmailForm from "./LoginWithEmailForm";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof LoginWithEmailForm> = {
  title: "Auth/EmailAuth/LoginWithEmailForm",
  tags: ["autodocs"],
  component: LoginWithEmailForm,
};

export default meta;

export const Shown: StoryObj<typeof LoginWithEmailForm> = {
  args: {
    notifyOnLogin: () => {
      action("login")();
    },
    isLoggingIn: false,
  },
};

export const LoggingIn: StoryObj<typeof LoginWithEmailForm> = {
  args: {
    isLoggingIn: true,
  },
};
