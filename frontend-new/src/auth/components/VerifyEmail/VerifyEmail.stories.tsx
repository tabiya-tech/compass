import { Meta, StoryObj } from "@storybook/react";
import VerifyEmail from "./VerifyEmail";

const meta: Meta<typeof VerifyEmail> = {
  title: "Auth/VerifyEmail",
  tags: ["autodocs"],
  component: VerifyEmail,
};

export default meta;

export const Shown: StoryObj<typeof VerifyEmail> = {
  args: {},
};
