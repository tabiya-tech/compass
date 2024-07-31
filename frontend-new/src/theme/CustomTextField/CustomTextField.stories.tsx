import CustomTextField from "./CustomTextField";
import { Meta, type StoryObj } from "@storybook/react";

const meta: Meta<typeof CustomTextField> = {
  title: "Components/CustomTextField",
  component: CustomTextField,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof CustomTextField>;

export const Shown: Story = {
  args: {
    label: "Name:",
    placeholder: "Enter your name here",
    value: "",
    onChange: () => {},
  },
};

export const ShownWithValue: Story = {
  args: {
    label: "Name:",
    placeholder: "Enter your name here",
    value: "John Doe",
    onChange: () => {},
  },
};
