import { Box, useTheme } from "@mui/material";
import Chat from "src/chat/Chat";

const uniqueId = "13cb726d-b36d-4ea6-a518-9bf8f1e7356f";

export const DATA_TEST_ID = {
  HOME_CONTAINER: `home-container-${uniqueId}`,
};

const Home = () => {
  const theme = useTheme();

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
