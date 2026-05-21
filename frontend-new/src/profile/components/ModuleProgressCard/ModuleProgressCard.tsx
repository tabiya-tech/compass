import React from "react";
import { Box, Card, CardContent, Typography, LinearProgress, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

const uniqueId = "module-progress-card-b7e3f4a5-8c9d-1e2f-3a4b-5c6d7e8f9a1b";

export const DATA_TEST_ID = {
  MODULE_PROGRESS_CARD: `module-progress-card-${uniqueId}`,
  MODULE_PROGRESS_TITLE: `module-progress-title-${uniqueId}`,
  MODULE_PROGRESS: (index: number) => `module-progress-${index}-${uniqueId}`,
};

export interface ModuleProgressCardProps {
  overallProgress: number;
  educationProgress: number;
  workProgress: number;
}

export const ModuleProgressCard: React.FC<ModuleProgressCardProps> = ({
  overallProgress,
  educationProgress,
  workProgress,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const safeOverallProgress = Math.max(0, Math.min(100, overallProgress));
  const safeEducationProgress = Math.max(0, Math.min(100, educationProgress));
  const safeWorkProgress = Math.max(0, Math.min(100, workProgress));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
      <Typography
        variant="h4"
        data-testid={DATA_TEST_ID.MODULE_PROGRESS_TITLE}
        sx={{
          color: theme.palette.text.primary,
          fontWeight: 700,
        }}
      >
        {t("home.profile.profileStrength")}
      </Typography>

      <Card
        sx={{ border: `1px solid ${theme.palette.divider}`, boxShadow: "none" }}
        data-testid={DATA_TEST_ID.MODULE_PROGRESS_CARD}
      >
        <CardContent
          sx={{
            padding: theme.fixedSpacing(theme.tabiyaSpacing.lg),
            "&:last-child": { paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg) },
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {/* Main Giant Progress */}
          <Box>
            <Typography variant="h5" fontWeight="bold" color="primary.main">
              {safeOverallProgress}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={safeOverallProgress}
              aria-label={t("home.profile.profileStrengthProgressAriaLabel")}
              data-testid={DATA_TEST_ID.MODULE_PROGRESS(0)}
              sx={{
                height: 12,
                mt: 1,
                borderRadius: 999,
                backgroundColor: theme.palette.divider,
                "& .MuiLinearProgress-bar": { backgroundColor: theme.palette.primary.main },
              }}
            />
          </Box>

          {/* Breakdowns */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {t("home.profile.educationSkills")}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={safeEducationProgress}
                aria-label={t("home.profile.educationSkillsProgressAriaLabel")}
                sx={{
                  flex: 1,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: theme.palette.divider,
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: theme.palette.primary.main,
                    opacity: 0.6,
                  },
                }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                fontWeight="bold"
                sx={{ width: 40, textAlign: "right" }}
              >
                {safeEducationProgress}%
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {t("home.profile.workSkills")}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={safeWorkProgress}
                aria-label={t("home.profile.workSkillsProgressAriaLabel")}
                sx={{
                  flex: 1,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: theme.palette.divider,
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: theme.palette.primary.main,
                    opacity: 0.6,
                  },
                }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                fontWeight="bold"
                sx={{ width: 40, textAlign: "right" }}
              >
                {safeWorkProgress}%
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
