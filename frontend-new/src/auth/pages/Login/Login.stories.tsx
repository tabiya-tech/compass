import { Meta, StoryObj } from "@storybook/react";
import Login from "./Login";

const meta: Meta<typeof Login> = {
  title: "Auth/Login",
  tags: ["autodocs"],
  component: Login,
};

export default meta;

export const Shown: StoryObj<typeof Login> = {
  args: {},
};
