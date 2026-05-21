import React, { useState } from "react";
import {
  Box,
  Skeleton,
  Typography,
  useTheme,
  Select,
  MenuItem,
  LinearProgress,
  SelectChangeEvent,
  ListSubheader,
  TextField,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";
import { useSkillsSupplyStats } from "src/hooks/useSkillsSupplyStats";
import { useJobDemandStats } from "src/hooks/useJobDemandStats";
import { useSkillsAnalyticsFilterOptions } from "src/hooks/useSkillsAnalyticsFilterOptions";
import MetricInfoIcon from "src/components/MetricInfoIcon/MetricInfoIcon";
import { MODULE_FILTER_LOCATIONS } from "src/data/moduleFilterOptions";

interface SkillsAnalyticsProps {
  institution?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: string[];
  searchPlaceholder: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  allLabel,
  options,
  searchPlaceholder,
}) => {
  const theme = useTheme();
  const [search, setSearch] = useState("");

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <Select
      size="small"
      value={value}
      onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
      onClose={() => setSearch("")}
      displayEmpty
      sx={{
        backgroundColor: theme.palette.background.paper,
        minWidth: 250,
        fontSize: theme.typography.body2.fontSize,
        "& .MuiSelect-select": { py: theme.fixedSpacing(0.5), fontSize: theme.typography.body2.fontSize },
      }}
      MenuProps={{
        autoFocus: false,
        PaperProps: { sx: { maxHeight: 400 } },
      }}
    >
      (
      <ListSubheader sx={{ py: theme.fixedSpacing(0.5), px: theme.fixedSpacing(1), lineHeight: "normal" }}>
        <TextField
          size="small"
          autoFocus
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => {
            // Stop the inner search field's change from bubbling to MUI
            // Select's own onChange (it reads e.target.value and crashes on
            // this event shape) — mirrors the onKeyDown guard below.
            e.stopPropagation();
            setSearch(e.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16 }} />
                </InputAdornment>
              ),
              sx: { fontSize: theme.typography.body2.fontSize },
            },
          }}
          sx={{ width: "100%" }}
        />
      </ListSubheader>
      <MenuItem value="" sx={{ fontSize: theme.typography.body2.fontSize }}>
        {allLabel}
      </MenuItem>
      {filtered.map((opt) => (
        <MenuItem key={opt} value={opt} sx={{ fontSize: theme.typography.body2.fontSize }}>
          {opt}
        </MenuItem>
      ))}
    </Select>
  );
};

const SkillsAnalytics: React.FC<SkillsAnalyticsProps> = ({ institution }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [province, setProvince] = useState("");
  const [sector, setSector] = useState("");

  const { sectors } = useSkillsAnalyticsFilterOptions();

  const { data: skillSupplyData, loading: skillSupplyLoading } = useSkillsSupplyStats(
    10,
    institution,
    province || undefined,
    sector || undefined
  );
  // Sector maps to job.category prefixes (jobs have no sector field aligned to
  // the Sector dropdown — see backend sector_mapping); province filters job.location.
  const { data: jobDemandData, loading: jobDemandLoading } = useJobDemandStats(
    10,
    province || undefined,
    sector || undefined
  );

  // Supply: top skills students actually have, as % of students with that skill vs total with any skill
  const supplyTotal = skillSupplyData?.total_students_with_skills ?? 0;
  const supplyData = (skillSupplyData?.top_skills ?? []).map((entry) => ({
    skillName: entry.skill_label,
    supplyPct: supplyTotal > 0 ? Math.round((entry.student_count / supplyTotal) * 100) : 0,
  }));

  // Demand: % of postings-with-a-linked-skill (denominator excludes postings
  // with none, keeping bars comparable to the supply chart).
  const jobsWithLinkedSkills = jobDemandData?.jobs_with_linked_skills ?? 0;
  const totalJobsInFilter = jobDemandData?.total_jobs ?? 0;
  const demandData = (jobDemandData?.top_skills_in_demand ?? []).map((entry) => ({
    skillName: entry.skill_label,
    demandPct: jobsWithLinkedSkills > 0 ? Math.round((entry.jobs_count / jobsWithLinkedSkills) * 100) : 0,
  }));
  const noLinkedSkillPct =
    totalJobsInFilter > 0 ? Math.round(((totalJobsInFilter - jobsWithLinkedSkills) / totalJobsInFilter) * 100) : 0;

  // rowKey is `${label}-${index}`: supply labels can repeat (grouped by UUID),
  // so label alone would collide as a React key.
  const renderSimpleBar = (rowKey: string, label: string, value: number, barColor: string, ariaLabel: string) => (
    <Box
      key={rowKey}
      display="grid"
      gridTemplateColumns="minmax(100px, 160px) 1fr 36px"
      gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
      alignItems="center"
      mb={0.5}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={value}
        aria-label={ariaLabel}
        sx={{
          height: 10,
          borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.xs),
          backgroundColor: theme.palette.divider,
          "& .MuiLinearProgress-bar": { backgroundColor: barColor, borderRadius: "inherit" },
        }}
      />
      <Typography variant="caption">{value}%</Typography>
    </Box>
  );

  return (
    <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}>
      {/* Chart Section */}
      <Box
        sx={{
          p: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          borderRadius: theme.rounding(theme.tabiyaRounding.sm),
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
          flexWrap="wrap"
          gap={2}
        >
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {t("dashboard.skillsAnalytics.supplyVsDemandTitle")}
            </Typography>
            <MetricInfoIcon title={t("dashboard.skillsAnalytics.supplyVsDemandTitleTooltip")} />
          </Box>
          <Box display="flex" gap={1}>
            <SearchableSelect
              value={province}
              onChange={setProvince}
              allLabel={t("dashboard.skillsAnalytics.filters.allProvinces")}
              options={MODULE_FILTER_LOCATIONS}
              searchPlaceholder={t("dashboard.skillsAnalytics.filters.searchProvinces")}
            />
            <SearchableSelect
              value={sector}
              onChange={setSector}
              allLabel={t("dashboard.skillsAnalytics.filters.allSectors")}
              options={sectors}
              searchPlaceholder={t("dashboard.skillsAnalytics.filters.searchSectors")}
            />
          </Box>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          {/* Left Column — Supply */}
          <Box sx={{ pr: { md: 3 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.text.secondary,
                  textTransform: "uppercase",
                }}
              >
                {t("dashboard.skillsAnalytics.topSkillsAmongStudents")}
              </Typography>
              <Box display="flex" gap={1.5}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box
                    sx={{ width: 12, height: 12, borderRadius: 0.5, backgroundColor: theme.palette.secondary.main }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t("dashboard.skillsAnalytics.legend.supply")}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box
                    sx={{
                      width: 2,
                      height: 14,
                      borderRadius: 1,
                      backgroundColor: theme.palette.primary.main,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t("dashboard.skillsAnalytics.legend.demand")}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box>
              {skillSupplyLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} variant="text" height={28} sx={{ mb: 0.5 }} />
                ))
              ) : supplyData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.comingSoon")}
                </Typography>
              ) : (
                supplyData.map((item, i) =>
                  renderSimpleBar(
                    `${item.skillName}-${i}`,
                    item.skillName,
                    item.supplyPct,
                    theme.palette.secondary.main,
                    t("dashboard.skillsAnalytics.aria.supplyBar", { skill: item.skillName, value: item.supplyPct })
                  )
                )
              )}
            </Box>
          </Box>

          {/* Right Column — Demand (Job Postings) */}
          <Box sx={{ borderLeft: { md: 1 }, borderColor: { md: "divider" }, pl: { md: 3 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.text.secondary,
                  textTransform: "uppercase",
                }}
              >
                {t("dashboard.skillsAnalytics.topSkillsInDemand")}
              </Typography>
              <Box display="flex" gap={1.5}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box sx={{ width: 12, height: 12, borderRadius: 0.5, backgroundColor: theme.palette.primary.main }} />
                  <Typography variant="caption" color="text.secondary">
                    {t("dashboard.skillsAnalytics.legend.demand")}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Box
                    sx={{
                      width: 2,
                      height: 14,
                      borderRadius: 1,
                      backgroundColor: theme.palette.secondary.main,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t("dashboard.skillsAnalytics.legend.supply")}
                  </Typography>
                </Box>
              </Box>
            </Box>
            {totalJobsInFilter > 0 && (
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("dashboard.skillsAnalytics.topSkillsInDemandCaption", {
                    withSkills: jobsWithLinkedSkills,
                    total: totalJobsInFilter,
                    pct: noLinkedSkillPct,
                  })}
                </Typography>
                <MetricInfoIcon title={t("dashboard.skillsAnalytics.topSkillsInDemandCaptionTooltip")} />
              </Box>
            )}
            <Box>
              {jobDemandLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} variant="text" height={28} sx={{ mb: 0.5 }} />
                ))
              ) : demandData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.comingSoon")}
                </Typography>
              ) : (
                demandData.map((item, i) =>
                  renderSimpleBar(
                    `${item.skillName}-${i}`,
                    item.skillName,
                    item.demandPct,
                    theme.palette.primary.main,
                    t("dashboard.skillsAnalytics.aria.demandBar", { skill: item.skillName, value: item.demandPct })
                  )
                )
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SkillsAnalytics;
