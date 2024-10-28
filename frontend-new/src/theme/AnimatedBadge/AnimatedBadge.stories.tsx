import { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import AnimatedBadge from "src/theme/AnimatedBadge/AnimatedBadge";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";

const meta: Meta<typeof AnimatedBadge> = {
  title: "Components/AnimatedBadge",
  component: AnimatedBadge,
  tags: ["autodocs"],
  argTypes: {},
};
export default meta;

type Story = StoryObj<typeof AnimatedBadge>;

export const Shown: Story = {
  args: {
    badgeContent: 2,
    invisible: false,
    children: <BadgeOutlinedIcon />,
  },
  render: (args) => (
    <Box sx={{ m: 8 }}>
      <AnimatedBadge {...args}>{args.children}</AnimatedBadge>
    </Box>
  ),
};

export const ShownWithTwoNumber: Story = {
  args: {
    badgeContent: 10,
    invisible: false,
    children: <BadgeOutlinedIcon />,
  },
  render: (args) => (
    <Box sx={{ m: 8 }}>
      <AnimatedBadge {...args}>{args.children}</AnimatedBadge>
    </Box>
  ),
};

export const ShownWithThreeNumber: Story = {
  args: {
    badgeContent: 100,
    invisible: false,
    children: <BadgeOutlinedIcon />,
  },
  render: (args) => (
    <Box sx={{ m: 8 }}>
      <AnimatedBadge {...args}>{args.children}</AnimatedBadge>
    </Box>
  ),
};
