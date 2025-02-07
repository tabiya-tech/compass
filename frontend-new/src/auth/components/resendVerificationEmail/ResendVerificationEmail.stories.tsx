import type { Meta, StoryObj } from "@storybook/react";
import ResendVerificationEmail, { COOLDOWN_SECONDS } from "./ResendVerificationEmail";
import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";

const meta = {
  title: "Auth/ResendVerificationEmail",
  component: ResendVerificationEmail,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <SnackbarProvider>
        <Story />
      </SnackbarProvider>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof ResendVerificationEmail>;

export default meta;
type Story = StoryObj<typeof meta>;

// Base story showing initial state
export const Initial: Story = {
  args: {
    email: "test@example.com",
    password: "Test123!@#",
    initialIsLoading: false,
    initialCooldownSeconds: 0,
  },
};

// Story showing the loading state
export const Loading: Story = {
  args: {
    email: "test@example.com",
    password: "Test123!@#",
    initialIsLoading: true,
    initialCooldownSeconds: 0,
  },
};

// Story showing the cooldown state with timer
export const Cooldown: Story = {
  args: {
    email: "test@example.com",
    password: "Test123!@#",
    initialIsLoading: false,
    initialCooldownSeconds: 30, // Show halfway through cooldown
  },
};

// Base state with long cooldown
export const LongCooldown: Story = {
  args: {
    email: "test@example.com",
    password: "Test123!@#",
    initialIsLoading: false,
    initialCooldownSeconds: COOLDOWN_SECONDS, // Show full cooldown period
  },
};