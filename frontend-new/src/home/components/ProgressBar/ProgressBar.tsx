import React, { startTransition } from "react";
import { Box, LinearProgress, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import CustomLink from "src/theme/CustomLink/CustomLink";

const uniqueId = "31a67579-b5e1-40dc-9ab1-eeffa3fc0207";

export const DATA_TEST_ID = {
  PROGRESS_BAR_CONTAINER: `progress-bar-container-${uniqueId}`,
  PROGRESS_BAR: `progress-bar-${uniqueId}`,
  PROGRESS_BAR_STRENGTH_TEXT: `progress-bar-strength-text-${uniqueId}`,
  PROGRESS_BAR_SEE_PROFILE_LINK: `progress-bar-see-profile-link-${uniqueId}`,
  PROGRESS_BAR_HINT: `progress-bar-hint-${uniqueId}`,
};

export interface ProgressBarProps {
  progress: number; // 0-100
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const navigateToProfile = () => {
    startTransition(() => {
      navigate(routerPaths.PROFILE);
    });
  };

  return (
    <Box
      data-testid={DATA_TEST_ID.PROGRESS_BAR_CONTAINER}
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
        padding: theme.spacing(theme.tabiyaSpacing.lg),
        backgroundColor: `color-mix(in srgb, ${theme.palette.tertiary.light} 16%, transparent)`,
        borderRadius: theme.rounding(theme.tabiyaRounding.sm),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: theme.tabiyaSpacing.xs,
          flexWrap: "wrap",
        }}
      >
        <Typography
          variant="body2"
          color="text.primary"
          sx={{ fontWeight: "bold" }}
          data-testid={DATA_TEST_ID.PROGRESS_BAR_STRENGTH_TEXT}
        >
          {t("home.profileStrength", { progress: clampedProgress })}
        </Typography>
        <CustomLink
          onClick={navigateToProfile}
          sx={{
            ...theme.typography.body2,
            color: theme.palette.tertiary.dark,
            textDecoration: "none",
            fontWeight: "bold",
            "&:hover": {
              color: theme.palette.tertiary.light,
              textDecoration: "underline",
            },
          }}
          data-testid={DATA_TEST_ID.PROGRESS_BAR_SEE_PROFILE_LINK}
        >
          {t("home.seeProfile")}
        </CustomLink>
      </Box>
      <LinearProgress
        variant="determinate"
        value={clampedProgress}
        aria-label="Profile Strength Progress Bar"
        data-testid={DATA_TEST_ID.PROGRESS_BAR}
        sx={{
          height: 20,
          borderRadius: theme.rounding(theme.tabiyaRounding.sm),
          overflow: "hidden",
          backgroundColor: theme.palette.grey[300],
          "& .MuiLinearProgress-bar": {
            borderRadius: 0,
            backgroundColor: theme.palette.tertiary.main,
          },
        }}
      />
      <Typography variant="body2" color="text.secondary" data-testid={DATA_TEST_ID.PROGRESS_BAR_HINT}>
        {t("home.profileStrengthHint")}
      </Typography>
    </Box>
  );
};

export default ProgressBar;
