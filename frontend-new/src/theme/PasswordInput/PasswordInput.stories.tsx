import { Meta, StoryObj } from "@storybook/react";
import PasswordInput from "./PasswordInput";

export default {
  title: "Components/PasswordInput",
  component: PasswordInput,
} as Meta;

type Story = StoryObj<typeof PasswordInput>;

export const Default: Story = {
  args: {
    label: "Password",
    placeholder: "Enter your password",
  },
};

export const WithCustomLabel: Story = {
  args: {
    label: "Secret Key",
    placeholder: "Enter your secret key",
  },
};

export const WithHelperText: Story = {
  args: {
    label: "Password",
    placeholder: "Enter your password",
  },
};

export const Disabled: Story = {
  args: {
    label: "Password",
    disabled: true,
    placeholder: "Enter your password",
  },
};

export const ErrorState: Story = {
  args: {
    label: "Password",
    error: true,
    placeholder: "Enter your password",
  },
};

export const FullWidth: Story = {
  args: {
    label: "Password",
    fullWidth: true,
    placeholder: "Enter your password",
  },
};

export const WithInitialValue: Story = {
  args: {
    label: "Password",
    defaultValue: "myPassword123",
  },
};

export const PasswordShown: Story = {
  args: {
    label: "Password",
    showPassword: true,
    defaultValue: "myPassword",
    placeholder: "Enter your password",
  },
};

export const PasswordHidden: Story = {
  args: {
    label: "Password",
    showPassword: false,
    defaultValue: "myPassword",
    placeholder: "Enter your password",
  },
};
