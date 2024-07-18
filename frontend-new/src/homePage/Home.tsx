import { useNavigate } from "react-router-dom";
import { Box, useTheme } from "@mui/material";
import { AuthContext } from "src/auth/Providers/AuthProvider/AuthProvider";
import { useContext, useEffect } from "react";
import { routerPaths } from "src/app/routerPaths";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import Chat from "src/chat/Chat";
import { UserPreferencesContext } from "src/auth/Providers/UserPreferencesProvider/UserPreferencesProvider";

const uniqueId = "13cb726d-b36d-4ea6-a518-9bf8f1e7356f";

export const DATA_TEST_ID = {
  HOME_CONTAINER: `home-container-${uniqueId}`,
};

const Home = () => {
  const theme = useTheme();
  const { handlePageLoad } = useContext(AuthContext);
  const { userPreferences } = useContext(UserPreferencesContext);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    handlePageLoad(
      (_user) => {
        // If the user has not accepted the terms and conditions, redirect them to the login page
        if (!userPreferences?.accepted_tc) {
          navigate(routerPaths.LOGIN, { replace: true });
        }
      },
      () => {
        // If there is an error getting the user from the token, redirect the user to the login page
        navigate(routerPaths.LOGIN, { replace: true });
        enqueueSnackbar("Please login to continue...", { variant: "info" });
      }
    );
  }, [enqueueSnackbar, handlePageLoad, navigate, userPreferences?.accepted_tc]);

  return (
    <Box
      display="flex"
      height="100%"
      width="100%"
      padding={theme.tabiyaSpacing.lg}
      data-testid={DATA_TEST_ID.HOME_CONTAINER}
    >
      <Chat />
    </Box>
  );
};

export default Home;
