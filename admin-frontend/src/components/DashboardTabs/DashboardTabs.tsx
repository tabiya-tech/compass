import React from "react";
import { Box, Tab, Tabs, useTheme } from "@mui/material";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import { useTranslation } from "react-i18next";

export type DashboardTabValue = "institutions" | "modules" | "skillsAnalytics" | "jobPostings";

export interface DashboardTabsProps {
  value: DashboardTabValue;
  onChange: (value: DashboardTabValue) => void;
}

const DashboardTabs: React.FC<DashboardTabsProps> = ({ value, onChange }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
      <Tabs
        value={value}
        onChange={(_, v) => onChange(v as DashboardTabValue)}
        aria-label={t("dashboard.tabs.ariaLabel")}
        textColor="inherit"
        sx={{
          "& .MuiTab-root": {
            textTransform: "none",
            minHeight: 44,
            fontWeight: 700,
            fontSize: "1rem",
          },
          "& .MuiTab-root.Mui-selected": {
            color: theme.palette.primary.main,
          },
        }}
      >
        <Tab
          value="institutions"
          label={t("dashboard.tabs.institutions")}
          icon={<ApartmentOutlinedIcon />}
          iconPosition="start"
        />
        <Tab value="modules" label={t("dashboard.tabs.modules")} icon={<GridViewOutlinedIcon />} iconPosition="start" />
        <Tab
          value="skillsAnalytics"
          label={t("dashboard.tabs.skillsAnalytics")}
          icon={<InsightsOutlinedIcon />}
          iconPosition="start"
        />
        <Tab
          value="jobPostings"
          label={t("dashboard.tabs.jobPostings")}
          icon={<WorkOutlineOutlinedIcon />}
          iconPosition="start"
        />
      </Tabs>
    </Box>
  );
};

export default DashboardTabs;
