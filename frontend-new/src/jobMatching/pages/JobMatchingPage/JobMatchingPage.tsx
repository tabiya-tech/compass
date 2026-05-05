import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Tabs, Tab, Typography, useTheme, Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { isConnectionError } from "src/error/restAPIError/isConnectionError";
import Footer from "src/home/components/Footer/Footer";
import DataTable from "src/jobMatching/components/DataTable/DataTable";
import type { ColumnDef } from "src/jobMatching/components/DataTable/DataTable";
import JobDetailModal from "src/jobMatching/components/JobDetailModal/JobDetailModal";
import { useJobs, PAGE_SIZE } from "src/jobMatching/hooks/useJobs";
import { useMatchedJobs } from "src/jobMatching/hooks/useMatchedJobs";
import JobService from "src/jobMatching/services/JobService";
import type { JobFilters, JobRow, JobSortKey } from "src/jobMatching/types";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const capitalize = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const toFilterOptions = (values: string[], selectedValue: string) => {
  const mergedValues = selectedValue === "all" ? values : Array.from(new Set([...values, selectedValue]));
  const sortedValues = [...mergedValues].sort((a, b) => a.localeCompare(b));
  return [{ value: "all", label: "All" }, ...sortedValues.map((value) => ({ value, label: capitalize(value) }))];
};

const EMPTY_FILTERS: JobFilters = { search: "", category: "all", employmentType: "all", location: "all" };
const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

// ─── Component ────────────────────────────────────────────────────────────────

const uniqueId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const DATA_TEST_ID = {
  JOB_MATCHING_CONTAINER: `job-matching-container-${uniqueId}`,
  JOB_MATCHING_TABS: `job-matching-tabs-${uniqueId}`,
};

const JobMatchingPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState(0);
  const [browseFilters, setBrowseFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [datasetFilterValues, setDatasetFilterValues] = useState<{
    category: string[];
    employmentType: string[];
    location: string[];
  }>({
    category: [],
    employmentType: [],
    location: [],
  });

  const debouncedSearch = useDebouncedValue(browseFilters.search, SEARCH_DEBOUNCE_MS);
  const queryFilters = useMemo(() => ({ ...browseFilters, search: debouncedSearch }), [browseFilters, debouncedSearch]);

  const { jobs, loading, error, page, totalPages, totalItems, sortKey, sortDir, onSortChange, onSortClear, goToPage } =
    useJobs(queryFilters);
  const {
    jobs: matchedJobs,
    loading: matchedLoading,
    error: matchedError,
    reload: reloadMatched,
    skillsSource: matchedSkillsSource,
  } = useMatchedJobs(activeTab === 1);

  useEffect(() => {
    let cancelled = false;

    const loadFilterValues = async () => {
      try {
        const categorySet = new Set<string>();
        const employmentTypeSet = new Set<string>();
        const locationSet = new Set<string>();
        let cursor: string | undefined;

        while (true) {
          const result = await JobService.getInstance().listJobs({ cursor, limit: 100 });
          result.data.forEach((doc) => {
            const category = doc.category?.trim();
            const employmentType = doc.employment_type?.trim();
            const location = doc.location?.trim();

            if (category) categorySet.add(category);
            if (employmentType) employmentTypeSet.add(employmentType);
            if (location) locationSet.add(location);
          });

          if (!result.meta.next_cursor) break;
          cursor = result.meta.next_cursor;
        }

        if (!cancelled) {
          setDatasetFilterValues({
            category: Array.from(categorySet),
            employmentType: Array.from(employmentTypeSet),
            location: Array.from(locationSet),
          });
        }
      } catch {
        if (!cancelled) {
          setDatasetFilterValues({ category: [], employmentType: [], location: [] });
        }
      }
    };

    void loadFilterValues();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo(
    () => toFilterOptions(datasetFilterValues.category, browseFilters.category),
    [datasetFilterValues.category, browseFilters.category]
  );
  const employmentTypeOptions = useMemo(
    () => toFilterOptions(datasetFilterValues.employmentType, browseFilters.employmentType),
    [datasetFilterValues.employmentType, browseFilters.employmentType]
  );
  const locationOptions = useMemo(
    () => toFilterOptions(datasetFilterValues.location, browseFilters.location),
    [datasetFilterValues.location, browseFilters.location]
  );

  const handleRowClick = (job: JobRow) => {
    setSelectedJob(job);
    setModalOpen(true);
  };

  const browsePageLabel = useMemo(() => {
    const enDash = "\u2013";
    if (totalItems === 0) return `Page 0${enDash}0 of 0`;
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalItems);
    return `Page ${start}${enDash}${end} of ${totalItems}`;
  }, [page, totalItems]);

  const columns: ColumnDef<JobRow>[] = useMemo(
    () => [
      {
        key: "jobTitle",
        label: "Job Title",
        sortable: true,
        align: "left",
        minWidth: 180,
        cellSx: {
          borderLeft: `3px solid ${theme.palette.primary.main}`,
        },
        render: (val) => (
          <Typography variant="body2" color="primary" fontWeight={600}>
            {capitalize(val as string)}
          </Typography>
        ),
      },
      {
        key: "company",
        label: "Company",
        sortable: false,
        align: "left",
        minWidth: 140,
        render: (val) => (
          <Typography variant="body2" color="text.primary">
            {capitalize(val as string)}
          </Typography>
        ),
      },
      {
        key: "category",
        label: "Category",
        sortable: true,
        align: "left",
        minWidth: 120,
        filter: {
          options: categoryOptions,
          value: browseFilters.category,
          onChange: (v) => setBrowseFilters((f) => ({ ...f, category: v })),
        },
        render: (val) => (
          <Typography variant="body2" color="text.secondary">
            {capitalize(val as string)}
          </Typography>
        ),
      },
      {
        key: "employmentType",
        label: "Type",
        sortable: false,
        align: "left",
        minWidth: 100,
        filter: {
          options: employmentTypeOptions,
          value: browseFilters.employmentType,
          onChange: (v) => setBrowseFilters((f) => ({ ...f, employmentType: v })),
        },
        render: (val) => {
          const palette = [
            { bg: theme.palette.tabiyaBlue.light, text: theme.palette.tabiyaBlue.contrastText },
            { bg: theme.palette.tabiyaGreen.light, text: theme.palette.tabiyaGreen.contrastText },
            { bg: theme.palette.tabiyaYellow.light, text: theme.palette.tabiyaYellow.contrastText },
            { bg: theme.palette.tabiyaRed.light, text: theme.palette.tabiyaRed.contrastText },
            { bg: theme.palette.info.light, text: theme.palette.info.dark },
            { bg: theme.palette.success.light, text: theme.palette.success.dark },
            { bg: theme.palette.warning.light, text: theme.palette.warning.dark },
          ];
          // Stable color per unique value using a simple hash
          const hash = (val as string).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const { bg, text } = palette[hash % palette.length];
          return (
            <Chip
              label={capitalize(val as string)}
              size="small"
              sx={{ backgroundColor: bg, color: text, fontWeight: 600, fontSize: "0.72rem", height: 20 }}
            />
          );
        },
      },
      {
        key: "location",
        label: "Location",
        sortable: true,
        align: "left",
        minWidth: 110,
        filter: {
          options: locationOptions,
          value: browseFilters.location,
          onChange: (v) => setBrowseFilters((f) => ({ ...f, location: v })),
        },
        render: (val) => (
          <Typography variant="body2" color="text.secondary">
            {capitalize(val as string)}
          </Typography>
        ),
      },
      {
        key: "posted",
        label: "Posted",
        sortable: true,
        align: "left",
        minWidth: 120,
        render: (val) => (
          <Typography variant="body2" color="text.secondary">
            {val as string}
          </Typography>
        ),
      },
    ],
    [browseFilters, categoryOptions, employmentTypeOptions, locationOptions, theme]
  );

  const matchedColumns: ColumnDef<JobRow>[] = useMemo(
    () => [
      ...columns,
      {
        key: "matchScore",
        label: "Match",
        align: "center",
        minWidth: 80,
        render: (val) => {
          if (val === undefined || val === null) return null;
          const score = val as number;
          return (
            <Chip
              label={`${score}%`}
              size="small"
              sx={{
                backgroundColor:
                  score >= 85
                    ? theme.palette.success.light
                    : score >= 70
                      ? theme.palette.warning.light
                      : theme.palette.grey[200],
                color:
                  score >= 85
                    ? theme.palette.success.dark
                    : score >= 70
                      ? theme.palette.warning.dark
                      : theme.palette.text.secondary,
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            />
          );
        },
      },
    ],
    [columns, theme]
  );
  const hasError = Boolean(error);
  const isConnectionFailure = hasError && isConnectionError(error);
  const errorMessage = (() => {
    if (!hasError) return null;
    if (isConnectionFailure) return t("common.errors.api.serverConnectionError");
    return t("common.errors.api.unableToProcessRequest");
  })();

  const hasMatchedError = Boolean(matchedError);
  const isMatchedConnectionFailure = hasMatchedError && isConnectionError(matchedError);
  const matchedErrorMessage = (() => {
    if (!hasMatchedError) return null;
    if (isMatchedConnectionFailure) return t("common.errors.api.serverConnectionError");
    return t("common.errors.api.unableToProcessRequest");
  })();

  return (
    <Box
      display="flex"
      flexDirection="column"
      minHeight="100vh"
      sx={{ backgroundColor: theme.palette.containerBackground.light }}
      data-testid={DATA_TEST_ID.JOB_MATCHING_CONTAINER}
    >
      <Box
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: "var(--layout-content-max-width)",
          mx: "auto",
          px: "var(--layout-gutter-x)",
          paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
          paddingTop: theme.fixedSpacing(theme.tabiyaSpacing.sm),
        }}
      >
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          data-testid={DATA_TEST_ID.JOB_MATCHING_TABS}
          sx={{
            mb: theme.fixedSpacing(theme.tabiyaSpacing.md),
            borderBottom: `1px solid ${theme.palette.divider}`,
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            },
          }}
        >
          <Tab label="Browse Jobs" />
          <Tab label="Matched for You" />
        </Tabs>

        {/* Browse Jobs tab */}
        {activeTab === 0 && (
          <>
            {hasError && (
              <Box
                sx={{
                  mb: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 2,
                }}
              >
                <Typography variant="body1" color="error.main">
                  {errorMessage}
                </Typography>
                <Box>
                  <PrimaryButton onClick={() => globalThis.location.reload()}>
                    {t("error.errorPage.refreshButton")}
                  </PrimaryButton>
                </Box>
              </Box>
            )}
            <DataTable<JobRow>
              rows={jobs}
              columns={columns}
              loading={loading}
              externalSortKey={sortKey}
              externalSortDir={sortDir}
              onSortChange={(key, dir) => onSortChange(key as JobSortKey, dir)}
              onSortClear={onSortClear}
              sortClearLabel="Clear sorting"
              tableMinWidth={750}
              ariaLabel="browse jobs table"
              emptyMessage="No jobs found."
              search={{
                placeholder: "Search job titles or companies...",
                ariaLabel: "search jobs",
                value: browseFilters.search,
                onChange: (v) => setBrowseFilters((f) => ({ ...f, search: v })),
              }}
              onRowClick={handleRowClick}
              page={page}
              totalPages={totalPages}
              onPageChange={goToPage}
              pageLabel={browsePageLabel}
            />
          </>
        )}

        {/* Matched for You tab */}
        {activeTab === 1 && (
          <>
            {hasMatchedError && (
              <Box
                sx={{
                  mb: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 2,
                }}
              >
                <Typography variant="body1" color="error.main">
                  {matchedErrorMessage}
                </Typography>
                <Box>
                  <PrimaryButton onClick={reloadMatched}>{t("error.errorPage.refreshButton")}</PrimaryButton>
                </Box>
              </Box>
            )}
            {matchedSkillsSource === "programme" && matchedJobs.length > 0 && (
              <Alert
                severity="info"
                data-testid="matched-jobs-programme-info-banner"
                sx={{ mb: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}
              >
                {t("jobMatching.matched.programmeBanner")}
              </Alert>
            )}
            <DataTable<JobRow>
              rows={matchedJobs}
              columns={matchedColumns}
              loading={matchedLoading}
              tableMinWidth={750}
              ariaLabel="matched jobs table"
              emptyMessage={
                matchedSkillsSource === "programme"
                  ? t("jobMatching.matched.emptyProgrammeNoMatches")
                  : matchedSkillsSource === "s&i"
                    ? t("jobMatching.matched.emptySiNoMatches")
                    : t("jobMatching.matched.emptyNoSkills")
              }
              onRowClick={handleRowClick}
            />
          </>
        )}
      </Box>

      <JobDetailModal job={selectedJob} open={modalOpen} onClose={() => setModalOpen(false)} />

      <Footer />
    </Box>
  );
};

export default JobMatchingPage;
