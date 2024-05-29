import { Box, Typography, useTheme } from "@mui/material";
import React from "react";
import Info from "./info/Info";

const App = () => {
  const theme = useTheme();
  return (
    <Box display={"flex"} flexDirection={"column"} padding={theme.tabiyaSpacing.lg}>
      <Typography variant="h2" align="center">
        Welcome to Tabiya Compass!
      </Typography>
      <Info />
    </Box>
  );
};

export default App;
