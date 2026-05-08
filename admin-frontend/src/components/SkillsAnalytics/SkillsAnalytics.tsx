import React from "react";
import { Box, Skeleton, Typography, useTheme, Select, MenuItem, LinearProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSkillGapStats } from "src/hooks/useSkillGapStats";
import { useSkillsSupplyStats } from "src/hooks/useSkillsSupplyStats";
import MetricInfoIcon from "src/components/MetricInfoIcon/MetricInfoIcon";
interface SkillsAnalyticsProps {
  institution?: string;
}

const SkillsAnalytics: React.FC<SkillsAnalyticsProps> = ({ institution }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: skillGapData, loading: skillGapLoading } = useSkillGapStats(10, institution);
  const { data: skillSupplyData, loading: skillSupplyLoading } = useSkillsSupplyStats(10, institution);

  // Supply: top skills students actually have, as % of students with that skill vs total with any skill
  const supplyTotal = skillSupplyData?.total_students_with_skills ?? 0;
  const supplyData = (skillSupplyData?.top_skills ?? []).map((entry) => ({
    skillName: entry.skill_label,
    supplyPct: supplyTotal > 0 ? Math.round((entry.student_count / supplyTotal) * 100) : 0,
  }));

  // Demand: top skill gaps from recommendations
  const demandTotal = skillGapData?.total_students_with_skill_gaps ?? 0;
  const demandData = (skillGapData?.top_skill_gaps ?? []).map((entry) => ({
    skillName: entry.skill_label,
    demandPct: demandTotal > 0 ? Math.round((entry.students_with_gap_count / demandTotal) * 100) : 0,
  }));
  const renderSimpleBar = (label: string, value: number, barColor: string, ariaLabel: string) => (
    <Box
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
          <Box display="flex" gap={2}>
            <Select
              size="small"
              value=""
              displayEmpty
              sx={{ backgroundColor: theme.palette.background.paper, minWidth: 140 }}
            >
              <MenuItem value="">{t("dashboard.skillsAnalytics.filters.allProvinces")}</MenuItem>
            </Select>
            <Select
              size="small"
              value=""
              displayEmpty
              sx={{ backgroundColor: theme.palette.background.paper, minWidth: 140 }}
            >
              <MenuItem value="">{t("dashboard.skillsAnalytics.filters.allSectors")}</MenuItem>
            </Select>
          </Box>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          {/* Left Column */}
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
                supplyData.map((item) =>
                  renderSimpleBar(
                    item.skillName,
                    item.supplyPct,
                    theme.palette.secondary.main,
                    t("dashboard.skillsAnalytics.aria.supplyBar", { skill: item.skillName, value: item.supplyPct })
                  )
                )
              )}
            </Box>
          </Box>

          {/* Right Column */}
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
            <Box>
              {skillGapLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} variant="text" height={28} sx={{ mb: 0.5 }} />
                ))
              ) : demandData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("dashboard.comingSoon")}
                </Typography>
              ) : (
                demandData.map((item) =>
                  renderSimpleBar(
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
