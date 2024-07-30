import { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import RegisterWithEmailForm from "./RegisterWithEmailForm";

const meta: Meta<typeof RegisterWithEmailForm> = {
  title: "Auth/EmailAuth/RegisterWithEmailForm",
  component: RegisterWithEmailForm,
  tags: ["autodocs"],
};

export default meta;

export const Shown: StoryObj<typeof RegisterWithEmailForm> = {
  args: {
    notifyOnRegister: action("notifyOnRegister"),
    isRegistering: false,
  },
};

export const Registering: StoryObj<typeof RegisterWithEmailForm> = {
  args: {
    notifyOnRegister: action("notifyOnRegister"),
    isRegistering: true,
  },
};
