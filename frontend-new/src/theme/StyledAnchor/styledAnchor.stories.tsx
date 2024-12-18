import type { Meta, StoryObj } from "@storybook/react";

import { StyledAnchor } from "./StyledAnchor";

const meta: Meta<typeof StyledAnchor> = {
  title: "Components/StyledAnchor",
  component: StyledAnchor,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof StyledAnchor>;

export const Shown: Story = {
  args: {
    href: "https://www.tabiya.com",
    children: "Tabiya",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    href: "https://www.tabiya.com",
    children: "Tabiya",
  },
};
