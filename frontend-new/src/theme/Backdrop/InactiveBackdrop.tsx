import React from "react";
import Paper from "@mui/material/Paper";
import { Theme } from "@mui/material/styles";
import { Backdrop, keyframes, Typography, useMediaQuery, useTheme } from "@mui/material";

interface InactivityBackdropProps {
  isShown: boolean;
}

const uniqueId = "e9ca9c1e-3933-4c5b-b5fd-453601ee9947";

export const DATA_TEST_ID = {
  INACTIVE_BACKDROP_CONTAINER: `inactive-backdrop-container-${uniqueId}`,
  INACTIVE_BACKDROP_MESSAGE: `inactive-backdrop-message-${uniqueId}`,
};

const moveX = keyframes`
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(100%);
    }
`;

const InactiveBackdrop: React.FC<InactivityBackdropProps> = ({ isShown }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  return (
    <Backdrop
      sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: "rgba(0, 0, 0, 0.75)" }}
      open={isShown}
      data-testid={DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER}
    >
      <Paper
        elevation={24}
        sx={{
          backgroundColor: "containerBackground.main",
          padding: isSmallMobile ? 4 : 2,
          position: "relative",
          animation: `${moveX} 20s linear infinite alternate`,
        }}
      >
        <Typography
          variant="body1"
          color="info.contrastText"
          fontWeight="bold"
          textAlign="center"
          data-testid={DATA_TEST_ID.INACTIVE_BACKDROP_MESSAGE}
        >
          ...zzZZzzZZ
          <br />
          Are you still here?
        </Typography>
      </Paper>
    </Backdrop>
  );
};

export default InactiveBackdrop;
