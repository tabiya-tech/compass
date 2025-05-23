import { Meta, StoryObj } from "@storybook/react";
import Landing from "./Landing";

const meta: Meta<typeof Landing> = {
  title: "Auth/Landing",
  component: Landing,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Landing>;

export const Shown: Story = {
  args: {},
};
