import React, { startTransition } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface ModuleHandoffBannerProps {
  /** Human-readable name of the next module (e.g. "Career Explorer") */
  nextModuleLabel: string;
  /** Route to navigate to when the user clicks the button */
  nextModuleRoute: string;
}

const uniqueId = "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f";

export const DATA_TEST_ID = {
  CONTAINER: `module-handoff-banner-container-${uniqueId}`,
  BUTTON: `module-handoff-banner-button-${uniqueId}`,
};

/**
 * Shown at the bottom of a module chat once it completes.
 * Invites the user to continue to the next module.
 */
const ModuleHandoffBanner: React.FC<ModuleHandoffBannerProps> = ({ nextModuleLabel, nextModuleRoute }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      data-testid={DATA_TEST_ID.CONTAINER}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: theme.spacing(theme.tabiyaSpacing.sm),
        padding: theme.spacing(theme.tabiyaSpacing.md),
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {t("home.moduleHandoff.message")}
      </Typography>
      <Button
        variant="contained"
        endIcon={<ArrowForwardIcon />}
        onClick={() => startTransition(() => navigate(nextModuleRoute))}
        data-testid={DATA_TEST_ID.BUTTON}
        sx={{ textTransform: "none" }}
      >
        {t("home.moduleHandoff.continueWith", { moduleLabel: nextModuleLabel })}
      </Button>
    </Box>
  );
};

export default ModuleHandoffBanner;
