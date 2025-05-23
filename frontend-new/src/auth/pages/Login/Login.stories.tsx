import { Meta, StoryObj } from "@storybook/react";
import Login from "./Login";
import { EnvVariables } from "src/envService";

const meta: Meta<typeof Login> = {
  title: "Auth/Login",
  tags: ["autodocs"],
  component: Login,
};

export default meta;

export const Shown: StoryObj<typeof Login> = {
  args: {},
};

export const ShownWithApplicationLoginCodeSet: StoryObj<typeof Login> = {
  args: {},
  beforeEach: () => {
    window.tabiyaConfig[EnvVariables.FRONTEND_LOGIN_CODE] = btoa("bar");
    return () => {
      delete window.tabiyaConfig[EnvVariables.FRONTEND_LOGIN_CODE];
    };
  },
};
