import React, { startTransition, useEffect, useMemo, useState } from "react";
import { Box, Divider, Typography, useTheme } from "@mui/material";
import HourglassEmptyOutlined from "@mui/icons-material/HourglassEmptyOutlined";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import type { ModuleSummary } from "src/careerReadiness/types";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import HomeJobReadyListSkeleton from "./HomeJobReadyListSkeleton";

const uniqueId = "c3d4e5f6-a7b8-9012-cdef-345678901234";

export const DATA_TEST_ID = {
  HOME_JOB_READY: `home-job-ready-${uniqueId}`,
  HOME_JOB_READY_ROW: `home-job-ready-row-${uniqueId}`,
};

function sortModules(modules: ModuleSummary[]): ModuleSummary[] {
  return [...modules].sort((a, b) => a.sort_order - b.sort_order);
}

function getActiveModuleId(sorted: ModuleSummary[]): string | null {
  const inProgress = sorted.find((m) => m.status === "IN_PROGRESS");
  if (inProgress) return inProgress.id;
  const unlocked = sorted.find((m) => m.status === "UNLOCKED");
  if (unlocked) return unlocked.id;
  return null;
}

const getDefaultExpandedId = (sorted: ModuleSummary[]): string | null => {
  const active = getActiveModuleId(sorted);
  if (active) return active;
  return sorted[0]?.id ?? null;
};

export interface HomeJobReadyListProps {
  modules: ModuleSummary[];
  isLoading: boolean;
  loadError: boolean;
}

const HomeJobReadyList: React.FC<HomeJobReadyListProps> = ({ modules, isLoading, loadError }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sorted = useMemo(() => sortModules(modules), [modules]);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  useEffect(() => {
    if (sorted.length === 0) return;
    setExpandedModuleId((prev) => {
      if (prev !== null && sorted.some((m) => m.id === prev)) return prev;
      return getDefaultExpandedId(sorted);
    });
  }, [sorted]);

  const secondary = theme.palette.secondary;

  const go = (path: string) => {
    startTransition(() => {
      navigate(path);
    });
  };

  const goToModule = (id: string) => {
    go(`${routerPaths.CAREER_READINESS}/${id}`);
  };

  if (isLoading) {
    return (
      <Box data-testid={DATA_TEST_ID.HOME_JOB_READY} role="status" aria-label={t("home.jobReadySection.loading")}>
        <HomeJobReadyListSkeleton />
      </Box>
    );
  }

  if (loadError || sorted.length === 0) {
    return (
      <Box data-testid={DATA_TEST_ID.HOME_JOB_READY}>
        <Typography variant="body2" color="text.primary">
          {loadError ? t("home.jobReadySection.loadError") : t("home.jobReadySection.empty")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box data-testid={DATA_TEST_ID.HOME_JOB_READY}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
          flexWrap: "wrap",
          marginBottom: {
            xs: theme.fixedSpacing(theme.tabiyaSpacing.lg),
            sm: theme.fixedSpacing(theme.tabiyaSpacing.xl),
          },
        }}
      >
        <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
          <Typography variant="h3" component="h2" fontWeight="bold" color="text.primary" sx={{ letterSpacing: -0.2 }}>
            {t("home.jobReadySection.title")}
          </Typography>
          <Typography
            variant="body2"
            color="text.primary"
            sx={{
              marginTop: theme.fixedSpacing(theme.tabiyaSpacing.xs),
              maxWidth: 520,
              lineHeight: 1.5,
            }}
          >
            {t("home.jobReadySection.description")}
          </Typography>
        </Box>
        <Typography
          component="button"
          type="button"
          variant="body2"
          fontWeight="bold"
          onClick={() => go(routerPaths.CAREER_READINESS)}
          sx={{
            color: "brandAction.main",
            textDecoration: "none",
            whiteSpace: "nowrap",
            background: "none",
            border: 0,
            padding: 0,
            margin: 0,
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {t("home.jobReadySection.seeFullCourse")}
        </Typography>
      </Box>

      <Box component="ul" sx={{ listStyle: "none", padding: 0, margin: 0 }}>
        {sorted.map((module, index) => {
          const n = index + 1;
          const isExpanded = module.id === expandedModuleId;
          const learningLabel =
            n === 1 ? t("home.jobReadySection.startLearning") : t("home.jobReadySection.continueLearning");
          const displayTitle = module.title;

          return (
            <Box key={module.id} component="li">
              {isExpanded ? (
                <Box
                  data-testid={`${DATA_TEST_ID.HOME_JOB_READY_ROW}-${module.id}`}
                  sx={{
                    border: `2px solid ${secondary.main}`,
                    borderRadius: theme.rounding(theme.tabiyaRounding.sm),
                    padding: {
                      xs: theme.fixedSpacing(theme.tabiyaSpacing.md),
                      sm: theme.fixedSpacing(theme.tabiyaSpacing.lg),
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.primary"
                    fontWeight="bold"
                    letterSpacing={1}
                    sx={{ textTransform: "uppercase" }}
                  >
                    {learningLabel}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      alignItems: { xs: "stretch", sm: "center" },
                      gap: {
                        xs: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                        sm: theme.fixedSpacing(theme.tabiyaSpacing.md),
                      },
                      marginTop: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        bgcolor: secondary.main,
                        color: secondary.contrastText,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        flexShrink: 0,
                      }}
                    >
                      {n}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body1" fontWeight="bold" color="text.primary">
                        {displayTitle}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                        <HourglassEmptyOutlined sx={{ fontSize: 18, color: "text.primary" }} />
                        <Typography variant="caption" color="text.primary">
                          {t("home.jobReadySection.durationHint")}
                        </Typography>
                      </Box>
                    </Box>
                    <PrimaryButton
                      color="secondary"
                      showCircle
                      onClick={() => goToModule(module.id)}
                      sx={{
                        alignSelf: "flex-start",
                      }}
                    >
                      {t("home.jobReadySection.startChat")}
                    </PrimaryButton>
                  </Box>
                </Box>
              ) : (
                <Box
                  data-testid={`${DATA_TEST_ID.HOME_JOB_READY_ROW}-${module.id}`}
                  onClick={() => setExpandedModuleId(module.id)}
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "stretch", sm: "center" },
                    gap: {
                      xs: theme.fixedSpacing(theme.tabiyaSpacing.xs),
                      sm: theme.fixedSpacing(theme.tabiyaSpacing.lg),
                    },
                    py: {
                      xs: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                      sm: theme.fixedSpacing(theme.tabiyaSpacing.md),
                    },
                    cursor: "pointer",
                    borderRadius: theme.rounding(theme.tabiyaRounding.sm),
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: `2px solid ${secondary.main}`,
                      color: secondary.main,
                      bgcolor: theme.palette.common.white,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      flexShrink: 0,
                    }}
                  >
                    {n}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" fontWeight="bold" color="text.primary">
                      {displayTitle}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: { xs: "flex-end", sm: "flex-end" }, minWidth: { sm: 120 } }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SecondaryButton
                      color="secondary"
                      onClick={() => goToModule(module.id)}
                      sx={{
                        fontSize: theme.typography.caption.fontSize,
                        padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs)} ${theme.fixedSpacing(theme.tabiyaSpacing.md)}`,
                      }}
                    >
                      {t("home.jobReadySection.chat")}
                    </SecondaryButton>
                  </Box>
                </Box>
              )}
              {index < sorted.length - 1 &&
                module.id !== expandedModuleId &&
                sorted[index + 1]?.id !== expandedModuleId && (
                  <Divider
                    sx={{
                      borderColor: `color-mix(in srgb, ${secondary.main} 35%, transparent)`,
                    }}
                  />
                )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default HomeJobReadyList;
