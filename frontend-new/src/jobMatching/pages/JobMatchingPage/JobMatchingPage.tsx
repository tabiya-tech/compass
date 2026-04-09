import React, { useState, useMemo } from "react";
import { Box, Tabs, Tab, Typography, useTheme, Chip, Alert } from "@mui/material";
import Footer from "src/home/components/Footer/Footer";
import DataTable from "src/jobMatching/components/DataTable/DataTable";
import type { ColumnDef } from "src/jobMatching/components/DataTable/DataTable";
import JobDetailModal from "src/jobMatching/components/JobDetailModal/JobDetailModal";
import { useJobs } from "src/jobMatching/hooks/useJobs";
import type { JobFilters, JobRow } from "src/jobMatching/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const capitalize = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const uniqueFilterOptions = (jobs: JobRow[], key: keyof JobRow) => {
  const values = Array.from(new Set(jobs.map((j) => String(j[key] ?? "")).filter(Boolean))).sort();
  return [{ value: "all", label: "All" }, ...values.map((v) => ({ value: v, label: capitalize(v) }))];
};

const EMPTY_FILTERS: JobFilters = { search: "", category: "all", employmentType: "all", location: "all" };

// ─── Component ────────────────────────────────────────────────────────────────

const uniqueId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const DATA_TEST_ID = {
  JOB_MATCHING_CONTAINER: `job-matching-container-${uniqueId}`,
  JOB_MATCHING_TABS: `job-matching-tabs-${uniqueId}`,
};

const JobMatchingPage: React.FC = () => {
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState(0);
  const [browseFilters, setBrowseFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { jobs, loading, error, hasNextPage, hasPrevPage, page, goToNextPage, goToPrevPage } = useJobs(browseFilters);

  // Client-side search filter (applied on top of server-side category/type/location filters)
  const displayedJobs = useMemo(() => {
    const q = browseFilters.search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => job.jobTitle.toLowerCase().includes(q) || job.company.toLowerCase().includes(q));
  }, [jobs, browseFilters.search]);

  const handleRowClick = (job: JobRow) => {
    setSelectedJob(job);
    setModalOpen(true);
  };

  const columns: ColumnDef<JobRow>[] = useMemo(
    () => [
      {
        key: "jobTitle",
        label: "Job Title",
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
        align: "left",
        minWidth: 140,
        filter: {
          options: uniqueFilterOptions(jobs, "category"),
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
        align: "left",
        minWidth: 100,
        filter: {
          options: uniqueFilterOptions(jobs, "employmentType"),
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
        align: "left",
        minWidth: 110,
        filter: {
          options: uniqueFilterOptions(jobs, "location"),
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
        align: "left",
        minWidth: 100,
        render: (val) => (
          <Typography variant="body2" color="text.secondary">
            {val as string}
          </Typography>
        ),
      },
    ],
    [jobs, browseFilters, theme]
  );

  const matchedColumns: ColumnDef<JobRow>[] = useMemo(
    () => [
      ...columns,
      {
        key: "matchScore",
        label: "Match",
        align: "center",
        minWidth: 80,
        render: (val) => (
          <Chip
            label={`${val}%`}
            size="small"
            sx={{
              backgroundColor:
                (val as number) >= 85
                  ? theme.palette.success.light
                  : (val as number) >= 70
                    ? theme.palette.warning.light
                    : theme.palette.grey[200],
              color:
                (val as number) >= 85
                  ? theme.palette.success.dark
                  : (val as number) >= 70
                    ? theme.palette.warning.dark
                    : theme.palette.text.secondary,
              fontWeight: 600,
              fontSize: "0.72rem",
            }}
          />
        ),
      },
    ],
    [columns, theme]
  );

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
          width: { xs: "100%", md: "60%" },
          margin: { xs: "0", md: "0 auto" },
          paddingX: theme.spacing(theme.tabiyaSpacing.md),
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
            {error && (
              <Alert severity="error" sx={{ mb: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
                {error}
              </Alert>
            )}
            <DataTable<JobRow>
              rows={displayedJobs}
              columns={columns}
              loading={loading}
              initialSortKey="posted"
              initialSortDir="desc"
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
              hasNextPage={hasNextPage}
              hasPrevPage={hasPrevPage}
              onNextPage={goToNextPage}
              onPrevPage={goToPrevPage}
              pageLabel={`Page ${page}`}
            />
          </>
        )}

        {/* Matched for You tab */}
        {activeTab === 1 && (
          <DataTable<JobRow>
            rows={[]}
            columns={matchedColumns}
            loading={false}
            tableMinWidth={750}
            ariaLabel="matched jobs table"
            emptyMessage="Matched jobs are not available yet. Complete your skills profile to unlock personalised recommendations."
          />
        )}
      </Box>

      <JobDetailModal job={selectedJob} open={modalOpen} onClose={() => setModalOpen(false)} />

      <Footer />
    </Box>
  );
};

export default JobMatchingPage;
