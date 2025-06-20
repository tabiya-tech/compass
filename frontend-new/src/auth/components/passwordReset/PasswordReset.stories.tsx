import type { Meta, StoryObj } from "@storybook/react";
import PasswordReset from "./PasswordReset";
import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";

const meta = {
  title: "Auth/PasswordReset",
  component: PasswordReset,
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
} satisfies Meta<typeof PasswordReset>;

export default meta;
type Story = StoryObj<typeof meta>;

const firebaseSuccessMock = [
  {
    url: "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=AIzaSyADoRJBGzpi9i1PFAhhXDzhqlA_l_Luz5I",
    method: "POST",
    status: 200,
    response: {},
  },
];

// Base state (normal)
export const Initial: Story = {
  args: {
    initialCooldownSeconds: 0,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

// Midway cooldown state
export const Cooldown: Story = {
  args: {
    initialCooldownSeconds: 30,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

// Full cooldown from start
export const LongCooldown: Story = {
  args: {
    initialCooldownSeconds: 60,
  },
  parameters: {
    mockData: firebaseSuccessMock,
  },
};

export const ApiFailure: Story = {
  args: {
    initialCooldownSeconds: 0,
  },
  parameters: {
    mockData: [
      {
        url: "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=AIzaSyADoRJBGzpi9i1PFAhhXDzhqlA_l_Luz5I",
        method: "POST",
        status: 400,
        response: {
          error: {
            message: "EMAIL_NOT_FOUND",
          },
        },
      },
    ],
  },
};
