import type { Meta, StoryObj } from "@storybook/react";

import { StyledAnchor } from "./StyledAnchor";

const meta: Meta<typeof StyledAnchor> = {
  title: "Components/StyledAnchor",
  component: StyledAnchor,
  tags: ["autodocs"],
  args: {
    href: "https://example.com",
    target: "_blank",
  },
};

export default meta;
type Story = StoryObj<typeof StyledAnchor>;

export const Shown: Story = {
  args: {
    children: "Tabiya",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Tabiya",
  },
};
