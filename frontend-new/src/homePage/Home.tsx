import { useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import { AuthContext } from "src/auth/AuthProvider";
import { useContext, useEffect } from "react";
import { routerPaths } from "src/app/routerPaths";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import Chat from "src/chat/Chat";

const uniqueId = "13cb726d-b36d-4ea6-a518-9bf8f1e7356f";

export const DATA_TEST_ID = {
  HOME_CONTAINER: `home-container-${uniqueId}`,
  HOME_TITLE: `home-title-${uniqueId}`,
  HOME_INFO: `home-info-${uniqueId}`,
  HOME_BUTTON: `home-button-${uniqueId}`,
};

const Home = () => {
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
    <Box data-testid={DATA_TEST_ID.HOME_CONTAINER}>
      <Chat />
    </Box>
  );
};

export default Home;
