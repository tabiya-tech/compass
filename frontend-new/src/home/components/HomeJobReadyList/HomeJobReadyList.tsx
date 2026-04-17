import React, { startTransition, useEffect, useMemo, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import type { ModuleSummary } from "src/careerReadiness/types";
import HomeJobReadyListSkeleton from "./HomeJobReadyListSkeleton";
import JobReadyListRow from "./JobReadyListRow";

const uniqueId = "c3d4e5f6-a7b8-9012-cdef-345678901234";

export const DATA_TEST_ID = {
  HOME_JOB_READY: `home-job-ready-${uniqueId}`,
  HOME_JOB_READY_ROW: `home-job-ready-row-${uniqueId}`,
};

function sortModules(modules: ModuleSummary[]): ModuleSummary[] {
  return [...modules].sort((a, b) => a.sort_order - b.sort_order);
}

function getActiveModuleId(sorted: ModuleSummary[]): string | null {
  return sorted.find((m) => m.status === "IN_PROGRESS")?.id ?? sorted.find((m) => m.status === "UNLOCKED")?.id ?? null;
}

const getDefaultExpandedId = (sorted: ModuleSummary[]): string | null =>
  getActiveModuleId(sorted) ?? sorted[0]?.id ?? null;

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
    if (sorted.length === 0) {
      return;
    }
    setExpandedModuleId((prev) =>
      prev !== null && sorted.some((m) => m.id === prev) ? prev : getDefaultExpandedId(sorted)
    );
  }, [sorted]);

  const go = (path: string) => {
    startTransition(() => {
      navigate(path);
    });
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
        {sorted.map((module, index) => (
          <JobReadyListRow
            key={module.id}
            module={module}
            moduleIndex={index}
            sorted={sorted}
            expandedModuleId={expandedModuleId}
            setExpandedModuleId={setExpandedModuleId}
            rowTestIdPrefix={DATA_TEST_ID.HOME_JOB_READY_ROW}
          />
        ))}
      </Box>
    </Box>
  );
};

export default HomeJobReadyList;
