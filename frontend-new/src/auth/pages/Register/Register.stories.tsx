import { Meta, StoryObj } from "@storybook/react";
import Register from "./Register";

const meta: Meta<typeof Register> = {
  title: "Auth/Register",
  component: Register,
  tags: ["autodocs"],
};

export default meta;

export const Shown: StoryObj<typeof Register> = {
  args: {},
};
