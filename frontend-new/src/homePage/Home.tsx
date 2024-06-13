import { NavLink } from "react-router-dom";
import { Box, Typography, useTheme } from "@mui/material";

const Home = () => {
  const theme = useTheme();
  return (
    <Box display="flex" flexDirection="column" gap={2} padding={theme.tabiyaSpacing.lg}>
      <Typography variant="h2" align="center">
        Welcome to Tabiya Compass!
      </Typography>
      <Box display="flex" flexDirection="column" alignItems="center">
        <Typography variant="h5">Click here to view the application page.</Typography>
        <NavLink to="/settings">Go to Info Page</NavLink>
      </Box>
    </Box>
  );
};

export default Home;
