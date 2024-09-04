import { Meta, StoryObj } from "@storybook/react";
import InternalError from "./InternalError";

const meta: Meta<typeof InternalError> = {
  title: "Application/InternalError",
  component: InternalError,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof InternalError>;

export const Shown: Story = {
  args: {},
};
