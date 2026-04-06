import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Container,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getUserFriendlyErrorMessage } from "src/error/restAPIError/RestAPIError";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import UserStateService from "src/userState/UserStateService";
import Header from "src/components/Header/Header";
import Footer from "src/components/Footer/Footer";
import StatCard from "src/components/StatCard/StatCard";
import DashboardTabs, { DashboardTabValue } from "src/components/DashboardTabs/DashboardTabs";
import DailyAdoptionTrendChart from "src/components/DailyAdoptionTrendChart/DailyAdoptionTrendChart";
import InstitutionsTable from "src/components/InstitutionsTable/InstitutionsTable";
import ModuleCard from "src/components/ModuleCard/ModuleCard";
import SkillsAnalytics from "src/components/SkillsAnalytics/SkillsAnalytics";
import JobPostings from "src/components/JobPostings/JobPostings";
import { MODULE_FILTER_LOCATIONS, MODULE_FILTER_YEARS } from "src/data/moduleFilterOptions";
import { useInstitutions } from "src/hooks/useInstitutions";
import { useInstitutionFilterOptions } from "src/hooks/useInstitutionFilterOptions";
import { useDashboardStats } from "src/hooks/useDashboardStats";
import { useModules } from "src/hooks/useModules";
import { useAdoptionTrends } from "src/hooks/useAdoptionTrends";

const uniqueId = "78972cb9-14de-4075-bd34-7fd96d135f5e";

export const DATA_TEST_ID = {
  DASHBOARD_PAGE_CONTAINER: `${uniqueId}-container`,
  DASHBOARD_PAGE_TITLE: `${uniqueId}-title`,
  DASHBOARD_STAT_CARD: `${uniqueId}-stat-card`,
};

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const {
    institutions,
    loading: institutionsLoading,
    page: institutionsPage,
    hasNextPage,
    hasPrevPage,
    goToNextPage,
    goToPrevPage,
    error: institutionsError,
  } = useInstitutions();
  const { stats, loading: statsLoading, error: statsError } = useDashboardStats();
  const { institutionNames } = useInstitutionFilterOptions();
  const [moduleFilters, setModuleFilters] = useState({
    location: "",
    institution: "",
    year: "",
  });

  const {
    modules,
    loading: modulesLoading,
    error: modulesError,
  } = useModules({
    location: moduleFilters.location || undefined,
    institution: moduleFilters.institution || undefined,
    year: moduleFilters.year || undefined,
  });
  const {
    labels: trendLabels,
    newRegistrations: trendNewReg,
    dailyActiveUsers: trendDAU,
    loading: trendLoading,
    error: trendError,
  } = useAdoptionTrends(7);

  const hasShownErrorRef = useRef(false);
  useEffect(() => {
    const err = institutionsError ?? statsError ?? trendError ?? modulesError;
    if (err && !hasShownErrorRef.current) {
      hasShownErrorRef.current = true;
      const message = err instanceof RestAPIError ? getUserFriendlyErrorMessage(err) : err.message;
      enqueueSnackbar(message, { variant: "error" });
    }
    if (!err) {
      hasShownErrorRef.current = false;
    }
  }, [institutionsError, statsError, trendError, modulesError, enqueueSnackbar]);

  const [tab, setTab] = useState<DashboardTabValue>("institutions");
  const displayName = useMemo(() => UserStateService.getInstance().getUserName() ?? undefined, []);

  const handleModuleFilterChange = (field: keyof typeof moduleFilters) => (event: SelectChangeEvent<string>) => {
    setModuleFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const moduleFiltersConfig = [
    {
      labelKey: "dashboard.modules.filters.allLocations" as const,
      value: moduleFilters.location,
      onChange: handleModuleFilterChange("location"),
      options: MODULE_FILTER_LOCATIONS,
    },
    {
      labelKey: "dashboard.modules.filters.allInstitutions" as const,
      value: moduleFilters.institution,
      onChange: handleModuleFilterChange("institution"),
      options: institutionNames,
    },
    {
      labelKey: "dashboard.modules.filters.allYears" as const,
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
      data-testid={DATA_TEST_ID.DASHBOARD_PAGE_CONTAINER}
    >
      <Header />

      <Container maxWidth="lg">
        <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.xl) }}>
          <Box>
            <Typography variant="overline" sx={{ color: theme.palette.primary.main, fontWeight: 700 }}>
              {t("dashboard.sectionTitle")}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700 }} data-testid={DATA_TEST_ID.DASHBOARD_PAGE_TITLE}>
              {t("dashboard.header.welcome", {
                name: displayName ?? t("header.user"),
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("dashboard.header.school")}
            </Typography>
          </Box>

          <Grid container spacing={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
            {statsLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Grid key={i} size={{ xs: 12, md: 4 }} data-testid={DATA_TEST_ID.DASHBOARD_STAT_CARD}>
                    <Skeleton variant="rounded" height={88} />
                  </Grid>
                ))
              : stats.map((stat) => (
                  <Grid
                    key={stat.id ?? stat.titleKey}
                    size={{ xs: 12, md: 4 }}
                    data-testid={DATA_TEST_ID.DASHBOARD_STAT_CARD}
                  >
                    <StatCard
                      title={t(stat.titleKey)}
                      value={stat.value}
                      subtitle={stat.subtitleKey ? t(stat.subtitleKey) : undefined}
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
            <DashboardTabs value={tab} onChange={setTab} />

            <Box sx={{ paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
              {tab === "institutions" && (
                <>
                  <Box sx={{ marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
                    <DailyAdoptionTrendChart
                      loading={trendLoading}
                      labels={trendLabels.length > 0 ? trendLabels : undefined}
                      newRegistrations={trendNewReg.length > 0 ? trendNewReg : undefined}
                      dailyActiveUsers={trendDAU.length > 0 ? trendDAU : undefined}
                    />
                  </Box>

                  <InstitutionsTable
                    rows={institutions}
                    loading={institutionsLoading}
                    page={institutionsPage}
                    hasNextPage={hasNextPage}
                    hasPrevPage={hasPrevPage}
                    onNextPage={goToNextPage}
                    onPrevPage={goToPrevPage}
                  />
                </>
              )}
              {tab === "modules" && (
                <>
                  <Grid
                    container
                    spacing={theme.fixedSpacing(theme.tabiyaSpacing.md)}
                    sx={{ marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
                  >
                    {moduleFiltersConfig.map((filter) =>
                      filter.labelKey === "dashboard.modules.filters.allInstitutions" ? (
                        <Grid key={filter.labelKey} size={{ xs: 12, sm: 6, md: 4 }}>
                          <Autocomplete
                            size="small"
                            options={filter.options}
                            value={filter.value || null}
                            isOptionEqualToValue={(option, value) => option === value}
                            onChange={(_e, value) => {
                              setModuleFilters((prev) => ({ ...prev, institution: value ?? "" }));
                            }}
                            renderInput={(params) => <TextField {...params} placeholder={t(filter.labelKey)} />}
                          />
                        </Grid>
                      ) : (
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
                      )
                    )}
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
              {tab === "skillsAnalytics" && <SkillsAnalytics />}
              {tab === "jobPostings" && <JobPostings />}
            </Box>
          </Box>
        </Box>
      </Container>

      <Footer />
    </Box>
  );
};

export default Dashboard;
