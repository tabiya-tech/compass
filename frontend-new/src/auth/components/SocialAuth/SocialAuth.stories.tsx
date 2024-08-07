import { Meta, StoryObj } from "@storybook/react";
import SocialAuth from "./SocialAuth";

const meta: Meta<typeof SocialAuth> = {
  title: "Auth/SocialAuth",
  tags: ["autodocs"],
  component: SocialAuth,
};

export default meta;

export const Shown: StoryObj<typeof SocialAuth> = {
  args: {},
};
