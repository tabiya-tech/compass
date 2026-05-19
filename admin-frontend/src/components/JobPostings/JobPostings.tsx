import React, { useMemo, useState } from "react";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { Box, Button, Chip, Grid, TextField, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import JobPostingDetailsDialog from "src/components/JobPostings/JobPostingDetailsDialog";
import StatCard from "src/components/StatCard/StatCard";
import DataTable from "src/components/DataTable/DataTable";
import type { ColumnDef } from "src/components/DataTable/DataTable";
import type { JobPostingRow } from "src/types";
import { useJobPostings } from "src/hooks/useJobPostings";

const MAX_VISIBLE_SKILLS = 2;
const MISSING_VALUE_LABEL = "—";
const PAGE_SIZE = 20;

const capitalize = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const renderCapitalizedText = (value: JobPostingRow[keyof JobPostingRow], bold = false) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return <span style={{ fontWeight: bold ? 700 : 400 }}>{MISSING_VALUE_LABEL}</span>;
  return <span style={{ fontWeight: bold ? 700 : 400 }}>{capitalize(text)}</span>;
};

const JobPostings: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sectorSearch, setSectorSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [platformSearch, setPlatformSearch] = useState("");
  const {
    rows: jobPostings,
    stats: jobPostingStats,
    loading,
    error,
    sortKey,
    sortDir,
    page,
    totalItems,
    totalPages,
    goToPage,
    onSortChange,
    onSortClear,
  } = useJobPostings({ searchQuery: search, sectorQuery: sectorSearch, locationQuery: locationSearch });
  const [selectedJob, setSelectedJob] = useState<JobPostingRow | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedPlatform = platformSearch.trim().toLowerCase();
    if (!normalizedPlatform) return jobPostings;
    return jobPostings.filter((row) => (row.platform ?? "").toLowerCase().includes(normalizedPlatform));
  }, [jobPostings, platformSearch]);

  const lastUpdatedSubtitle = useMemo(() => {
    const latestTimestamp = Math.max(
      ...jobPostings.map((row) => Date.parse(row.postedDate ?? "")).filter((timestamp) => Number.isFinite(timestamp)),
      Number.NEGATIVE_INFINITY
    );

    if (!Number.isFinite(latestTimestamp)) {
      return undefined;
    }

    const latestDate = new Date(latestTimestamp);
    return t("dashboard.jobPostings.stats.lastUpdatedOn", { date: latestDate.toLocaleDateString() });
  }, [jobPostings, t]);

  const columns: ColumnDef<JobPostingRow>[] = useMemo(
    () => [
      {
        key: "jobTitle",
        label: t("dashboard.jobPostings.table.jobTitle"),
        align: "left",
        minWidth: 180,
        sortable: true,
        sortType: "text",
        render: (val) => renderCapitalizedText(val, true),
      },
      {
        key: "sector",
        label: t("dashboard.jobPostings.table.sector"),
        align: "left",
        minWidth: 130,
        sortable: true,
        sortType: "text",
        render: (val) => renderCapitalizedText(val),
      },
      {
        key: "location",
        label: t("dashboard.jobPostings.table.location"),
        align: "left",
        minWidth: 110,
        sortable: true,
        sortType: "text",
        render: (val) => renderCapitalizedText(val),
      },
      {
        key: "platform",
        label: t("dashboard.jobPostings.table.platform"),
        align: "left",
        minWidth: 110,
        sortable: true,
        sortType: "text",
        render: (val) => renderCapitalizedText(val),
      },
      {
        key: "skills",
        label: t("dashboard.jobPostings.table.skillsExtracted"),
        align: "left",
        minWidth: 160,
        sortable: false,
        render: (val, row) => {
          const skills = val as string[];
          if (!skills || skills.length === 0) return null;
          const visible = skills.slice(0, MAX_VISIBLE_SKILLS);
          const extra = skills.length - MAX_VISIBLE_SKILLS;
          return (
            <Box display="flex" flexWrap="wrap" gap={0.5} alignItems="center">
              {visible.map((s) => (
                <Chip
                  key={s}
                  label={capitalize(s)}
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.grey[100],
                    border: `1px solid ${theme.palette.divider}`,
                    fontSize: "0.72rem",
                    height: 20,
                  }}
                />
              ))}
              {extra > 0 && (
                <Box
                  component="span"
                  onClick={() => setSelectedJob(row)}
                  sx={{
                    fontSize: "0.72rem",
                    color: "primary.main",
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {t("dashboard.jobPostings.moreSkills", { count: extra })}
                </Box>
              )}
            </Box>
          );
        },
      },
      {
        key: "jobUrl",
        label: t("dashboard.jobPostings.table.link"),
        align: "center",
        minWidth: 60,
        sortable: false,
        render: (val, row) =>
          val ? (
            <Button
              component="a"
              href={val as string}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              variant="text"
              size="small"
              sx={{ minWidth: 0, p: 0.5 }}
              aria-label={t("dashboard.jobPostings.aria.openJob", { title: row.jobTitle ?? MISSING_VALUE_LABEL })}
            >
              <OpenInNewOutlinedIcon fontSize="small" />
            </Button>
          ) : null,
      },
    ],
    [theme, t]
  );

  const pageRangeLabel = t("dashboard.pagination.range", {
    start: totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
    end: totalItems === 0 ? 0 : Math.min(page * PAGE_SIZE, totalItems),
    total: totalItems,
  });

  return (
    <Box sx={{ paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
      <Grid container spacing={theme.fixedSpacing(theme.tabiyaSpacing.md)} sx={{ marginBottom: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard
            title={t("dashboard.jobPostings.stats.jobsSourced")}
            value={jobPostingStats.jobsSourced}
            subtitle={lastUpdatedSubtitle}
            tooltip={t("dashboard.jobPostings.stats.jobsSourcedTooltip")}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard
            title={t("dashboard.jobPostings.stats.sectorsCovered")}
            value={jobPostingStats.sectorsCovered}
            subtitle={t("dashboard.jobPostings.stats.sectorsCoveredSubtitle")}
            tooltip={t("dashboard.jobPostings.stats.sectorsCoveredTooltip")}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard
            title={t("dashboard.jobPostings.stats.sourcePlatforms")}
            value={jobPostingStats.sourcePlatformsCount}
            tooltip={t("dashboard.jobPostings.stats.sourcePlatformsTooltip")}
          />
        </Grid>
      </Grid>

      {error && <Box sx={{ color: "error.main", mb: 1, fontSize: "0.85rem" }}>{error.message}</Box>}

      <Grid container spacing={theme.fixedSpacing(theme.tabiyaSpacing.sm)} sx={{ marginBottom: 1.5 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t("dashboard.jobPostings.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={`${t("dashboard.jobPostings.table.sector")}...`}
            value={sectorSearch}
            onChange={(e) => setSectorSearch(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={`${t("dashboard.jobPostings.table.location")}...`}
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={`${t("dashboard.jobPostings.table.platform")}...`}
            value={platformSearch}
            onChange={(e) => setPlatformSearch(e.target.value)}
          />
        </Grid>
      </Grid>

      <DataTable<JobPostingRow>
        rows={filteredRows}
        columns={columns}
        loading={loading}
        skeletonRows={8}
        externalSortKey={sortKey}
        externalSortDir={sortDir}
        onSortChange={onSortChange}
        onSortClear={onSortClear}
        sortClearLabel={t("dashboard.dataTable.clearSorting")}
        ariaLabel={t("dashboard.jobPostings.aria.table")}
        emptyMessage={t("dashboard.jobPostings.jobsCount", { count: 0, total: 0 })}
        tableMinWidth={750}
        page={page}
        totalPages={totalPages}
        onPageChange={goToPage}
        pageLabel={pageRangeLabel}
      />

      <JobPostingDetailsDialog job={selectedJob} isOpen={Boolean(selectedJob)} onClose={() => setSelectedJob(null)} />
    </Box>
  );
};

export default JobPostings;
