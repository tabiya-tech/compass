import type { Meta, StoryObj } from "@storybook/react";

import React from "react";
import { Box, Container, Typography } from "@mui/material";
import AuthPageShell from "./AuthPageShell";

const meta: Meta<typeof AuthPageShell> = {
  title: "Auth/AuthPageShell",
  component: AuthPageShell,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AuthPageShell>;

export const Default: Story = {
  args: {
    logoUrl: `${process.env.PUBLIC_URL}/njila-logo-dark.svg`,
    whiteBandContent: (
      <Box sx={{ pt: 3 }}>
        <Typography variant="h2">White band content</Typography>
        <Typography variant="body2">This sits on the white background with Shapes.svg.</Typography>
      </Box>
    ),
    children: (
      <Container sx={{ py: 6 }}>
        <Typography variant="h2">Cream content</Typography>
        <Typography variant="body2">This sits on the cream background.</Typography>
      </Container>
    ),
  },
};
