import { Meta, StoryObj } from "@storybook/react";
import CustomLink from "./CustomLink";

const meta: Meta<typeof CustomLink> = {
  title: "Components/CustomLink",
  component: CustomLink,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof CustomLink>;

export const Default: Story = {
  args: {
    children: ["Hello"],
    href: "#",
  },
};

export const Disabled: Story = {
  args: {
    children: ["Hello"],
    disabled: true,
    href: "#",
  },
};
