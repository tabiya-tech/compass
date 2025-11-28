import React from "react";
import { useTranslation } from "react-i18next";
import Paper from "@mui/material/Paper";
import { Theme } from "@mui/material/styles";
import { Backdrop, Typography, useMediaQuery, useTheme } from "@mui/material";

interface InactivityBackdropProps {
  isShown: boolean;
}

const uniqueId = "e9ca9c1e-3933-4c5b-b5fd-453601ee9947";

export const DATA_TEST_ID = {
  INACTIVE_BACKDROP_CONTAINER: `inactive-backdrop-container-${uniqueId}`,
  INACTIVE_BACKDROP_MESSAGE: `inactive-backdrop-message-${uniqueId}`,
};

const InactiveBackdrop: React.FC<InactivityBackdropProps> = ({ isShown }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const { t } = useTranslation();
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
          padding: isSmallMobile ? 6 : 4,
          position: "relative",
        }}
      >
        <Typography
          variant="body1"
          color="info.contrastText"
          textAlign="center"
          data-testid={DATA_TEST_ID.INACTIVE_BACKDROP_MESSAGE}
        >
          {t("theme.backdrop.inactiveBackdrop.title")}
          <br />
          {t("theme.backdrop.inactiveBackdrop.tapAnywhere")}
        </Typography>
      </Paper>
    </Backdrop>
  );
};

export default InactiveBackdrop;
