import { Meta, type StoryObj } from "@storybook/react";
import PasswordTextField from "./PasswordTextField";

const meta: Meta<typeof PasswordTextField> = {
  title: "Auth/PasswordTextField",
  component: PasswordTextField,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof PasswordTextField>;

export const Shown: Story = {
  args: {},
};
