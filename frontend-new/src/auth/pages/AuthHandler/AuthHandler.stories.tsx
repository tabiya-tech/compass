import React, { useLayoutEffect } from "react";
import { Meta, StoryObj } from "@storybook/react";
import AuthHandler from "src/auth/pages/AuthHandler/AuthHandler";
import { firebaseAuth } from "src/auth/firebaseConfig";

interface StoryArgs {
  mode: "verifyEmail" | "recoverEmail" | "resetPassword" | "missing";
  // controls how the firebase action calls behave so the visual state is predictable
  outcome: "success" | "error" | "pending";
}

// Replace the firebaseAuth methods with story-controlled fakes — the real firebaseAuth is a live
// `firebase.auth()` instance that would otherwise hit the real backend and fail without an API key.
const installFakeFirebase = ({ mode, outcome }: StoryArgs) => {
  const neverResolves = () => new Promise<never>(() => {});
  const fail = () => Promise.reject({ code: "auth/expired-action-code", message: "expired" });

  const auth = firebaseAuth as unknown as {
    applyActionCode: (oob: string) => Promise<void>;
    verifyPasswordResetCode: (oob: string) => Promise<string>;
    confirmPasswordReset: (oob: string, password: string) => Promise<void>;
    checkActionCode: (oob: string) => Promise<{ data: { email?: string } }>;
    sendPasswordResetEmail: (email: string) => Promise<void>;
  };

  if (outcome === "pending") {
    auth.applyActionCode = neverResolves;
    auth.verifyPasswordResetCode = neverResolves;
    auth.checkActionCode = neverResolves;
    auth.confirmPasswordReset = neverResolves;
    auth.sendPasswordResetEmail = neverResolves;
    return;
  }

  if (outcome === "error") {
    auth.applyActionCode = fail;
    auth.verifyPasswordResetCode = fail;
    auth.checkActionCode = fail;
    auth.confirmPasswordReset = fail;
    auth.sendPasswordResetEmail = fail;
    return;
  }

  // outcome === "success"
  auth.applyActionCode = () => Promise.resolve();
  auth.verifyPasswordResetCode = () => Promise.resolve("user@example.com");
  auth.confirmPasswordReset = () => Promise.resolve();
  auth.checkActionCode = () => Promise.resolve({ data: { email: "previous@example.com" } });
  auth.sendPasswordResetEmail = () => Promise.resolve();
  // Hint for unused vars — referenced for consistency with the matrix above.
  void mode;
};

// Drive the URL — HashRouter reads the hash for path + search, so we set it before the story renders.
const SetHash: React.FC<{ args: StoryArgs; children: React.ReactNode }> = ({ args, children }) => {
  useLayoutEffect(() => {
    const search =
      args.mode === "missing" ? "" : `?mode=${args.mode}&oobCode=fake-oob-code&apiKey=fake-key&continueUrl=&lang=en`;
    window.location.hash = `/auth-handler${search}`;
  }, [args.mode]);
  return <>{children}</>;
};

const meta: Meta<typeof AuthHandler> = {
  title: "Auth/AuthHandler",
  component: AuthHandler,
  tags: ["autodocs"],
  argTypes: {
    mode: {
      control: { type: "select" },
      options: ["verifyEmail", "recoverEmail", "resetPassword", "missing"],
    },
    outcome: {
      control: { type: "select" },
      options: ["success", "error", "pending"],
    },
  } as Meta<typeof AuthHandler>["argTypes"],
  decorators: [
    (Story, context) => {
      const args = context.args as unknown as StoryArgs;
      installFakeFirebase(args);
      return (
        <SetHash args={args}>
          <Story />
        </SetHash>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof AuthHandler>;

export const VerifyEmailSuccess: Story = {
  args: { mode: "verifyEmail", outcome: "success" },
};

export const VerifyEmailProcessing: Story = {
  args: { mode: "verifyEmail", outcome: "pending" },
};

export const VerifyEmailError: Story = {
  args: { mode: "verifyEmail", outcome: "error" },
};

export const ResetPasswordForm: Story = {
  args: { mode: "resetPassword", outcome: "success" },
};

export const ResetPasswordError: Story = {
  args: { mode: "resetPassword", outcome: "error" },
};

export const RecoverEmailSuccess: Story = {
  args: { mode: "recoverEmail", outcome: "success" },
};

export const RecoverEmailError: Story = {
  args: { mode: "recoverEmail", outcome: "error" },
};

export const InvalidLink: Story = {
  args: { mode: "missing", outcome: "error" },
};
