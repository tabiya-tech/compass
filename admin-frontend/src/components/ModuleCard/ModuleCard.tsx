import React from "react";
import { Box, LinearProgress, Typography, useTheme } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { useTranslation } from "react-i18next";
import type { ModuleData } from "src/types";
import MetricInfoIcon from "src/components/MetricInfoIcon/MetricInfoIcon";

export interface ModuleCardProps {
  module: ModuleData;
}

const ModuleCard: React.FC<ModuleCardProps> = ({ module }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const barColorStart = theme.palette.primary.main;
  const barColorComplete = theme.palette.secondary.main;

  return (
    <Box
      sx={{
        borderRadius: theme.rounding(theme.tabiyaRounding.sm),
        padding: theme.fixedSpacing(theme.tabiyaSpacing.lg),
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.secondary,
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap={1}
        marginBottom={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      >
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {t(module.titleKey)}
          </Typography>
          {module.tooltipKey && <MetricInfoIcon title={t(module.tooltipKey)} />}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t("dashboard.modules.registeredStudents", { count: module.totalStudents })}
        </Typography>
      </Box>

      <Box
        display="flex"
        flexDirection={{ xs: "column", md: "row" }}
        gap={{ xs: theme.fixedSpacing(theme.tabiyaSpacing.xl), md: 0 }}
      >
        {/* Left column: Summary */}
        <Box
          flex="0 0 auto"
          minWidth={0}
          sx={{ width: { xs: "100%", md: "45%" }, paddingRight: { md: theme.fixedSpacing(theme.tabiyaSpacing.xl) } }}
        >
          {module.summary.map((row) => (
            <Box key={row.labelKey} marginBottom={theme.fixedSpacing(theme.tabiyaSpacing.lg)}>
              <Typography
                variant="caption"
                sx={{
                  textTransform: "uppercase",
                  color: theme.palette.text.secondary,
                  display: "block",
                  marginBottom: 1,
                }}
              >
                {t(row.labelKey).toUpperCase()}
              </Typography>
              {row.showBar ? (
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, marginBottom: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1 }}>
                    {row.value.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>
                    / {row.total.toLocaleString()} ({row.pct}%)
                  </Typography>
                </Box>
              ) : (
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: theme.palette.text.primary, marginBottom: 1, lineHeight: 1 }}
                >
                  {row.value}{" "}
                  <Box
                    component="span"
                    sx={{ fontSize: "0.875rem", fontWeight: 600, color: theme.palette.text.secondary }}
                  >
                    of {row.total}
                  </Box>
                </Typography>
              )}
              {row.showBar && (
                <LinearProgress
                  variant="determinate"
                  value={row.pct}
                  aria-label={t(row.labelKey)}
                  sx={{
                    height: 8,
                    borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.md),
                    backgroundColor: theme.palette.divider,
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: row.labelKey.endsWith(".started") ? barColorStart : barColorComplete,
                      borderRadius: "inherit",
                    },
                  }}
                />
              )}
            </Box>
          ))}
        </Box>

        {/* Right column: Breakdown */}
        <Box
          flex="1 1 auto"
          minWidth={0}
          sx={{
            borderLeft: { md: `1px solid ${theme.palette.divider}` },
            paddingLeft: { md: theme.fixedSpacing(theme.tabiyaSpacing.xl) },
            paddingTop: { xs: theme.fixedSpacing(theme.tabiyaSpacing.md), md: 0 },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: theme.palette.text.secondary,
              display: "block",
              marginBottom: module.breakdownCaption ? 0.5 : 1,
            }}
          >
            {t(module.breakdownTitleKey).toUpperCase()}
          </Typography>
          {module.breakdownCaption && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ marginBottom: 1 }}>
              {t(module.breakdownCaption)}
            </Typography>
          )}

          {module.breakdownType === "funnel" && (
            <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
              {module.breakdownItems.map((item, idx) => {
                const total = item.total ?? 1;
                const pct = total > 0 ? Math.round(((item.value ?? 0) / total) * 100) : 0;
                const isLast = idx === module.breakdownItems.length - 1;
                const barColor = isLast ? barColorComplete : barColorStart;
                return (
                  <Box key={item.labelKey}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={0.5}>
                      <Typography variant="body1">{t(item.labelKey)}</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {item.value}{" "}
                        <Box component="span" sx={{ fontWeight: 400 }}>
                          / {total}
                        </Box>
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      aria-label={t(item.labelKey)}
                      sx={{
                        height: 24,
                        borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.xs),
                        backgroundColor: theme.palette.divider,
                        "& .MuiLinearProgress-bar": {
                          backgroundColor: barColor,
                          borderRadius: "inherit",
                        },
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          )}

          {module.breakdownType === "subModules" &&
            (() => {
              const labels = module.breakdownItems.map((item, idx) => `${idx + 1}. ${t(item.labelKey)}`);
              // ~5.5px per char at 10px font size, +8px padding
              const yAxisWidth = Math.max(60, Math.max(...labels.map((l) => l.length)) * 5.5 + 8);
              return (
                <BarChart
                  height={Math.max(200, module.breakdownItems.length * 60)}
                  layout="horizontal"
                  yAxis={[
                    {
                      scaleType: "band",
                      data: labels,
                      width: yAxisWidth,
                      categoryGapRatio: 0.4,
                      barGapRatio: 0.2,
                      tickLabelStyle: { fontSize: 10 },
                    },
                  ]}
                  series={[
                    {
                      data: module.breakdownItems.map((item) => item.total ?? 0),
                      label: t("dashboard.modules.startedLegend"),
                      color: barColorStart,
                    },
                    {
                      data: module.breakdownItems.map((item) => item.value ?? 0),
                      label: t("dashboard.modules.completedLegend"),
                      color: barColorComplete,
                    },
                  ]}
                  grid={{ vertical: true }}
                  slotProps={{
                    legend: {
                      direction: "horizontal",
                      position: { vertical: "bottom", horizontal: "start" },
                    },
                  }}
                  margin={{ left: 8, right: 16, top: 8, bottom: 60 }}
                />
              );
            })()}

          {module.breakdownType === "topSectors" && (
            <Box
              display="grid"
              gridTemplateColumns="minmax(120px, 1fr) minmax(0, 2fr) 40px"
              gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
              alignItems="center"
            >
              {module.breakdownItems.map((item) => (
                <React.Fragment key={item.labelKey}>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    {t(item.labelKey)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={item.percentage ?? 0}
                    aria-label={t(item.labelKey)}
                    sx={{
                      height: 16,
                      borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.xs),
                      backgroundColor: theme.palette.divider,
                      "& .MuiLinearProgress-bar": {
                        backgroundColor:
                          item.color === "primary"
                            ? theme.palette.primary.main
                            : item.color === "secondary"
                              ? theme.palette.secondary.main
                              : theme.palette.primary.main,
                        borderRadius: "inherit",
                      },
                    }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "right", fontWeight: 700 }}>
                    {item.percentage}%
                  </Typography>
                </React.Fragment>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ModuleCard;
