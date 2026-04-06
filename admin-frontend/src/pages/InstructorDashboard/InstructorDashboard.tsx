import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Container, FormControl, Grid, MenuItem, Select, Skeleton, Typography, useTheme } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getUserFriendlyErrorMessage } from "src/error/restAPIError/RestAPIError";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import Header from "src/components/Header/Header";
import Footer from "src/components/Footer/Footer";
import StatCard from "src/components/StatCard/StatCard";
import ModuleCard from "src/components/ModuleCard/ModuleCard";
import SkillsAnalytics from "src/components/SkillsAnalytics/SkillsAnalytics";
import InstructorDashboardTabs, {
  InstructorDashboardTabValue,
} from "src/components/InstructorDashboardTabs/InstructorDashboardTabs";
import InstructorStudentsTable from "src/components/InstructorStudentsTable/InstructorStudentsTable";
import type { InstructorDashboardStatItem } from "src/types";
import { useModules } from "src/hooks/useModules";
import { useInstructorStudents } from "src/hooks/useInstructorStudents";
import { useDashboardStats } from "src/hooks/useDashboardStats";
import UserStateService from "src/userState/UserStateService";
import { MODULE_FILTER_LOCATIONS, MODULE_FILTER_YEARS } from "src/data/moduleFilterOptions";
import { decodeInstitutionId } from "src/utils/institutionUtils";

const InstructorDashboard: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const { stats: dashboardStats, loading: statsLoading, error: statsError } = useDashboardStats();
  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    hasMoreRows: studentsHasMoreRows,
    loadMoreRows: loadMoreStudentsRows,
  } = useInstructorStudents();
  const activeStudents = dashboardStats.find((item) => item.id === "activeStudents7Days");
  const totalStudents = dashboardStats.find((item) => item.id === "totalStudentsRegistered");
  const pct =
    Number(totalStudents?.value) > 0
      ? Math.round((Number(activeStudents?.value ?? 0) / Number(totalStudents?.value ?? 1)) * 100)
      : 0;
  const stats: InstructorDashboardStatItem[] = [
    {
      id: "totalStudentsRegistered",
      titleKey: "instructorDashboard.stats.totalStudentsRegistered",
      value: totalStudents?.value ?? 0,
    },
    {
      id: "activeStudents7Days",
      titleKey: "instructorDashboard.stats.activeStudents7Days",
      value: activeStudents?.value ?? 0,
      subtitleKey: "instructorDashboard.stats.activeStudents7DaysSubtitle",
      subtitleValues: { pct },
    },
  ];
  const displayName = useMemo(
    () => UserStateService.getInstance().getUserName() ?? t("instructorDashboard.header.defaultName"),
    [t]
  );
  const institutionName = useMemo(() => {
    const institutionId = UserStateService.getInstance().getInstitutionId();
    if (!institutionId) return t("instructorDashboard.header.institutionFallback");
    try {
      return decodeInstitutionId(institutionId);
    } catch {
      return t("instructorDashboard.header.institutionFallback");
    }
  }, [t]);
  const [moduleFilters, setModuleFilters] = useState({
    location: "",
    institution: "",
    year: "",
  });

  const [tab, setTab] = useState<InstructorDashboardTabValue>("students");
  const {
    modules,
    loading: modulesLoading,
    error: modulesError,
  } = useModules({
    location: moduleFilters.location || undefined,
    // Always scope to the instructor's own institution
    institution: institutionName,
    year: moduleFilters.year || undefined,
  });
  const hasShownErrorRef = useRef(false);

  useEffect(() => {
    const err = statsError ?? studentsError ?? modulesError;
    if (err && !hasShownErrorRef.current) {
      hasShownErrorRef.current = true;
      const message = err instanceof RestAPIError ? getUserFriendlyErrorMessage(err) : err.message;
      enqueueSnackbar(message, { variant: "error" });
    }
    if (!err) {
      hasShownErrorRef.current = false;
    }
  }, [enqueueSnackbar, modulesError, statsError, studentsError]);

  const handleModuleFilterChange = (field: keyof typeof moduleFilters) => (event: SelectChangeEvent<string>) => {
    setModuleFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const moduleFiltersConfig = [
    {
      labelKey: "dashboard.modules.filters.allLocations",
      value: moduleFilters.location,
      onChange: handleModuleFilterChange("location"),
      options: MODULE_FILTER_LOCATIONS,
    },
    {
      labelKey: "dashboard.modules.filters.allYears",
      value: moduleFilters.year,
      onChange: handleModuleFilterChange("year"),
      options: MODULE_FILTER_YEARS,
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: theme.palette.containerBackground.light,
      }}
    >
      <Header />

      <Container maxWidth="lg">
        <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.xl) }}>
          <Box>
            <Typography variant="overline" sx={{ color: theme.palette.primary.main, fontWeight: 700 }}>
              {t("instructorDashboard.sectionTitle")}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700 }}>
              {t("instructorDashboard.header.welcome", { name: displayName })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {institutionName}
            </Typography>
          </Box>

          <Grid container spacing={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
            {statsLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <Grid key={i} size={{ xs: 12, md: 4 }}>
                    <Skeleton variant="rounded" height={88} />
                  </Grid>
                ))
              : stats.map((stat) => (
                  <Grid key={stat.id} size={{ xs: 12, md: 4 }}>
                    <StatCard
                      title={t(stat.titleKey)}
                      value={stat.value}
                      subtitle={stat.subtitleKey ? t(stat.subtitleKey, stat.subtitleValues) : undefined}
                    />
                  </Grid>
                ))}
          </Grid>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: theme.fixedSpacing(theme.tabiyaSpacing.lg),
              backgroundColor: theme.palette.background.paper,
              borderRadius: theme.tabiyaRounding.sm,
            }}
          >
            <InstructorDashboardTabs value={tab} onChange={setTab} />

            <Box sx={{ paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
              {tab === "students" && (
                <Box sx={{ px: { xs: 0, sm: 0 } }}>
                  <InstructorStudentsTable
                    rows={students}
                    loading={studentsLoading}
                    hasMoreRows={studentsHasMoreRows}
                    onLoadMoreRows={loadMoreStudentsRows}
                  />
                </Box>
              )}

              {tab === "modules" && (
                <>
                  <Grid
                    container
                    spacing={theme.fixedSpacing(theme.tabiyaSpacing.md)}
                    sx={{ marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
                  >
                    {moduleFiltersConfig.map((filter) => (
                      <Grid key={filter.labelKey} size={{ xs: 12, sm: 6, md: 4 }}>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={filter.value}
                            onChange={filter.onChange}
                            displayEmpty
                            aria-label={t(filter.labelKey)}
                          >
                            <MenuItem value="">{t(filter.labelKey)}</MenuItem>
                            {filter.options.map((option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    ))}
                  </Grid>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
                  >
                    {modulesLoading
                      ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} variant="rounded" height={220} />)
                      : modules.map((module) => <ModuleCard key={module.id} module={module} />)}
                  </Box>
                </>
              )}

              {tab === "skillsAnalytics" && <SkillsAnalytics institution={institutionName} />}
            </Box>
          </Box>
        </Box>
      </Container>

      <Footer />
    </Box>
  );
};

export default InstructorDashboard;
