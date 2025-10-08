import { Meta, StoryObj } from "@storybook/react";
import LoginWithInviteCodeForm from "./LoginWithInviteCodeForm";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof LoginWithInviteCodeForm> = {
  title: "Auth/AnonymousAuth/LoginWithInviteCodeForm",
  tags: ["autodocs"],
  component: LoginWithInviteCodeForm,
};

export default meta;

export const Shown: StoryObj<typeof LoginWithInviteCodeForm> = {
  args: {
    notifyOnInviteCodeChanged: action("notifyOnInviteCodeChanged"),
    isDisabled: false,
  },
};

export const LoggingIn: StoryObj<typeof LoginWithInviteCodeForm> = {
  args: {
    notifyOnInviteCodeChanged: action("notifyOnInviteCodeChanged"),
    isDisabled: true,
  },
};
