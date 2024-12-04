import type { Meta, StoryObj } from "@storybook/react";
import BugReportButton from "src/feedback/bugReportButton/BugReportButton";

const meta: Meta<typeof BugReportButton> = {
  title: "Components/BugReportButton",
  component: BugReportButton,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BugReportButton>;

export const Shown: Story = {
  args: {},
};
