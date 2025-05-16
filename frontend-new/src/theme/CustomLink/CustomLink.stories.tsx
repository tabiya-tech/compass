import { Meta, StoryObj } from "@storybook/react";
import CustomLink from "./CustomLink";

const meta: Meta<typeof CustomLink> = {
  title: "Components/CustomLink",
  component: CustomLink,
  tags: ["autodocs"],
  argTypes: {
    onClick: { action: "clicked" },
  },
  args: {
    href: "https://example.com",
    target: "_blank",
  },
};

export default meta;

type Story = StoryObj<typeof CustomLink>;

export const Shown: Story = {
  args: {
    children: ["Hello"],
  },
};

export const Disabled: Story = {
  args: {
    children: ["Hello"],
    disabled: true,
  },
};
