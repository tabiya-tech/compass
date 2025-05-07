import type { Meta, StoryObj } from "@storybook/react";
import { ThemeProvider } from "@mui/material";
import { applicationTheme, ThemeMode } from "src/theme/applicationTheme/applicationTheme";
import BucketLevel from "./BucketLevel";

const theme = applicationTheme(ThemeMode.LIGHT);

const meta: Meta<typeof BucketLevel> = {
  title: "Components/BucketLevel",
  component: BucketLevel,
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BucketLevel>;

export const Empty: Story = {
  args: {
    fillLevel: 0,
  },
};

export const HalfFull: Story = {
  args: {
    fillLevel: 50,
  },
};

export const Full: Story = {
  args: {
    fillLevel: 100,
  },
};

export const Disabled: Story = {
  args: {
    fillLevel: 75,
    disabled: true,
  },
};

export const Interactive: Story = {
  args: {
    fillLevel: 25,
    onClick: () => alert("Bucket clicked!"),
  },
}; 