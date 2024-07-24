// a component that wraps all children in a Box with a specific style
// shared by all components in the app
// like overflow: hidden
// and height: 100%

import React from "react";
import { Box } from "@mui/material";

interface AppWrapperProps {
  children: React.ReactNode;
}

const ViewPortWrapper: React.FC<Readonly<AppWrapperProps>> = ({ children }: AppWrapperProps) => {
  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>{children}</Box>
  );
};

export default ViewPortWrapper;