import InactiveBackdrop from "src/theme/Backdrop/InactiveBackdrop";
import { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof InactiveBackdrop> = {
  title: "Components/InactiveBackdrop",
  component: InactiveBackdrop,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof InactiveBackdrop>;

export const Shown: Story = {
  args: { isShown: true },
};
