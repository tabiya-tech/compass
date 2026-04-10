import React, { startTransition, useMemo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import type { ModuleSummary } from "src/careerReadiness/types";

const uniqueId = "f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c";

export const DATA_TEST_ID = {
  PROGRESS_BANNER: `career-readiness-progress-banner-${uniqueId}`,
  PROGRESS_BAR_SEGMENT: `career-readiness-progress-bar-segment-${uniqueId}`,
  PROGRESS_REMAINING: `career-readiness-progress-remaining-${uniqueId}`,
  CONTINUE_BUTTON: `career-readiness-continue-button-${uniqueId}`,
};

interface CareerReadinessProgressBannerProps {
  modules: ModuleSummary[];
}

const CareerReadinessProgressBanner: React.FC<CareerReadinessProgressBannerProps> = ({ modules }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sortedModules = useMemo(() => {
    return [...modules].sort((a, b) => a.sort_order - b.sort_order);
  }, [modules]);

  const total = sortedModules.length;
  const completed = sortedModules.filter((m) => m.status === "COMPLETED").length;

  const nextModule = useMemo(() => {
    return sortedModules.find((m) => m.status !== "COMPLETED") || sortedModules[0];
  }, [sortedModules]);

  const handleContinue = () => {
    if (!nextModule) return;
    startTransition(() => {
      navigate(`${routerPaths.CAREER_READINESS}/${nextModule.id}`);
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
      <Typography
        variant="h4"
        sx={{
          color: theme.palette.text.primary,
          fontWeight: 700,
        }}
      >
        {t("careerReadiness.pageTitle")}
      </Typography>

      <Box
        sx={{
          borderRadius: theme.rounding(theme.tabiyaRounding.md),
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          padding: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          display: "flex",
          flexDirection: "column",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
        data-testid={DATA_TEST_ID.PROGRESS_BANNER}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Typography
            variant="caption"
            fontWeight="700"
            color="text.secondary"
            data-testid={DATA_TEST_ID.PROGRESS_REMAINING}
          >
            {t("careerReadiness.modulesCompletedOfTotal", { completed, total })}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: theme.fixedSpacing(theme.tabiyaSpacing.xs), width: "100%" }}>
          {total > 0 ? (
            sortedModules.map((m) => {
              const isComplete = m.status === "COMPLETED";
              const isNext = Boolean(nextModule && m.id === nextModule.id);

              let bgColor = theme.palette.grey[200];
              let opacity = 1;

              if (isComplete) {
                bgColor = theme.palette.primary.main;
                opacity = 1;
              } else if (isNext) {
                bgColor = theme.palette.primary.main;
                opacity = 0.55;
              }

              return (
                <Box
                  key={m.id}
                  data-testid={`${DATA_TEST_ID.PROGRESS_BAR_SEGMENT}-${m.id}`}
                  sx={{
                    flex: 1,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: bgColor,
                    opacity,
                  }}
                />
              );
            })
          ) : (
            <Box sx={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: theme.palette.grey[200] }} />
          )}
        </Box>

        {nextModule && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
            <Typography variant="caption" fontWeight="700" color="primary.main">
              {t("careerReadiness.upNext")}:
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {nextModule.title}
            </Typography>
          </Box>
        )}

        {nextModule && (
          <PrimaryButton
            type="button"
            color="primary"
            showCircle
            onClick={handleContinue}
            data-testid={DATA_TEST_ID.CONTINUE_BUTTON}
            sx={{
              width: "100%",
              mt: 1,
              paddingY: 1.5,
              textTransform: "none",
              fontSize: "1rem",
            }}
          >
            {t("careerReadiness.continue")}: {nextModule.title}
          </PrimaryButton>
        )}
      </Box>
    </Box>
  );
};

export default CareerReadinessProgressBanner;
