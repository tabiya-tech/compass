import { Meta, StoryObj } from "@storybook/react";
import Register from "./Register";
import Login from "../Login/Login";
import { EnvVariables } from "../../../envService";

const meta: Meta<typeof Register> = {
  title: "Auth/Register",
  component: Register,
  tags: ["autodocs"],
};

export default meta;

export const Shown: StoryObj<typeof Register> = {
  args: {},
};

export const ShownWithApplicationRegistrationCodeSet: StoryObj<typeof Login> = {
  args: {},
  beforeEach: () => {
    window.tabiyaConfig[EnvVariables.FRONTEND_REGISTRATION_CODE] = btoa("bar");
    return () => {
      delete window.tabiyaConfig[EnvVariables.FRONTEND_REGISTRATION_CODE];
    };
  },
};
