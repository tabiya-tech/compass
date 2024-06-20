import { NavLink, useNavigate } from "react-router-dom";
import { Box, Typography, useTheme } from "@mui/material";
import { AuthContext } from "src/auth/AuthProvider";
import { useContext, useEffect } from "react";
import { routerPaths } from "src/app/routerPaths";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

const uniqueId = "13cb726d-b36d-4ea6-a518-9bf8f1e7356f";

export const DATA_TEST_ID = {
  HOME_CONTAINER: `home-container-${uniqueId}`,
  HOME_TITLE: `home-title-${uniqueId}`,
  HOME_INFO: `home-info-${uniqueId}`,
  HOME_BUTTON: `home-button-${uniqueId}`,
};

const Home = () => {
  const theme = useTheme();
  const { handlePageLoad } = useContext(AuthContext);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    handlePageLoad(
      (_user) => {},
      () => {
        navigate(routerPaths.LOGIN, { replace: true });
        enqueueSnackbar("Please login to continue...", { variant: "info" });
      }
    );
  }, [enqueueSnackbar, handlePageLoad, navigate]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={2}
      padding={theme.tabiyaSpacing.lg}
      data-testid={DATA_TEST_ID.HOME_CONTAINER}
    >
      <Typography variant="h2" align="center" data-testid={DATA_TEST_ID.HOME_TITLE}>
        Welcome to Tabiya Compass!
      </Typography>
      <Box display="flex" flexDirection="column" alignItems="center">
        <Typography variant="h5" data-testid={DATA_TEST_ID.HOME_INFO}>
          Click here to view the application page.
        </Typography>
        <NavLink to="/settings" data-testid={DATA_TEST_ID.HOME_BUTTON}>
          Go to Info Page
        </NavLink>
      </Box>
    </Box>
  );
};

export default Home;
