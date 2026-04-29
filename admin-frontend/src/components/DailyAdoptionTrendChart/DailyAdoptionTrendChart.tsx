import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { useTranslation } from "react-i18next";
import MetricInfoIcon from "src/components/MetricInfoIcon/MetricInfoIcon";

export interface DailyAdoptionTrendChartProps {
  labels?: string[];
  newRegistrations?: number[];
  dailyActiveUsers?: number[];
  loading?: boolean;
}

const DailyAdoptionTrendChart: React.FC<DailyAdoptionTrendChartProps> = ({
  labels,
  newRegistrations,
  dailyActiveUsers,
  loading = false,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const hasData = labels && labels.length > 0;

  return (
    <Box
      sx={{
        borderRadius: theme.rounding(theme.tabiyaRounding.sm),
        padding: theme.fixedSpacing(theme.tabiyaSpacing.md),
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.sm),
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.secondary,
          }}
        >
          {t("dashboard.dailyAdoptionTrend.title")}
        </Typography>
        <MetricInfoIcon title={t("dashboard.dailyAdoptionTrend.titleTooltip")} />
      </Box>

      {loading ? (
        <Skeleton variant="rounded" width="100%" height={280} />
      ) : !hasData ? (
        <Box
          sx={{
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {t("dashboard.dailyAdoptionTrend.noData")}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ width: "100%" }}>
          <BarChart
            height={280}
            xAxis={[
              {
                scaleType: "band",
                data: labels,
                barGapRatio: 0.5,
                categoryGapRatio: 0.5,
              },
            ]}
            series={[
              {
                data: newRegistrations!,
                label: t("dashboard.dailyAdoptionTrend.newRegistrations"),
                color: theme.palette.primary.main,
              },
              {
                data: dailyActiveUsers!,
                label: t("dashboard.dailyAdoptionTrend.dailyActiveUsers"),
                color: theme.palette.secondary.main,
              },
            ]}
            grid={{ horizontal: true }}
            slotProps={{
              legend: {
                direction: "horizontal",
                position: { vertical: "bottom", horizontal: "start" },
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default DailyAdoptionTrendChart;
